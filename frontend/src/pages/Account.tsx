import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { api, ApiRequestError, useApi } from '../api';
import { useSession } from '../contexts/SessionContext';
import { Button, Card, Modal, SectionHeading } from '../components/ui';
import { formatFullDate, toKst } from '../utils/format';

/** 가입 이메일과 가입일을 보고, 탈퇴합니다 (FR-02·03). 3.1 */
export function Account() {
  const navigate = useNavigate();
  const { signOut } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meQ = useApi(() => api.users.me(), []);
  const me = meQ.data;

  const remove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await api.users.remove();
      setConfirming(false);
      signOut();
      navigate('/');
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError ?
        caught.message :
        '탈퇴하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setRemoving(false);
    }
  };

  const rows = me ?
  [
  { term: '가입 이메일', value: me.email },
  { term: '가입일', value: formatFullDate(toKst(me.createdAt).date) }] :
  [];

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <SectionHeading
          eyebrow="설정"
          title="내 정보"
          description="가입 정보를 확인하고 탈퇴할 수 있습니다." />

        <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
          <dl className="divide-y divide-line2">
            {rows.length === 0 &&
            <div className="px-5 py-3">
                <p className="text-small text-muted">
                  {meQ.loading ?
                  '불러오는 중…' :
                  '가입 정보를 불러오지 못했습니다.'}
                </p>
                {!meQ.loading &&
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={meQ.reload}>

                    다시 시도
                  </Button>
                }
              </div>
            }
            {rows.map((row) =>
            <div key={row.term} className="flex gap-4 px-5 py-3">
                <dt className="w-32 shrink-0 text-small text-muted">{row.term}</dt>
                <dd className="text-small font-normal text-ink">{row.value}</dd>
              </div>
            )}
          </dl>
        </section>

        <Card as="section" padding="md" className="mt-4">
          <h2 className="text-h4 font-bold text-ink">탈퇴</h2>
          <p className="mt-1.5 text-body leading-6 text-ink2">
            탈퇴하면 계정과 함께 올린 카드내역·거래, 판정 결과, 되묻기 질문과 답변,
            사업자 문진이 모두 사라집니다. 되돌릴 수 없습니다.
          </p>
          <p className="mt-2 text-small leading-6 text-muted">
            법령 데이터와 서비스 공용 가맹점 사전은 남습니다. 사용자 데이터가 아닙니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="danger"
              size="md"
              disabled={!me}
              onClick={() => setConfirming(true)}>

              탈퇴하기
            </Button>
            <Button to="/uploads" variant="secondary" size="md">
              업로드 이력
            </Button>
          </div>
        </Card>

        <Modal
          open={confirming}
          onClose={() => setConfirming(false)}
          tone="danger"
          title="정말 탈퇴할까요?"
          description="되돌릴 수 없습니다. 이 이메일로 다시 로그인할 수 없고, 아래 데이터가 함께 사라집니다."
          footer={
          <>
              <Button
              variant="secondary"
              size="md"
              disabled={removing}
              onClick={() => setConfirming(false)}>

                취소
              </Button>
              <Button
              variant="danger"
              size="md"
              disabled={removing}
              onClick={() => void remove()}>

                {removing ? '탈퇴하는 중…' : '탈퇴하기'}
              </Button>
            </>
          }>

          {error &&
          <p
            role="alert"
            className="mb-4 rounded-xl border border-deny-line bg-deny-bg px-4 py-3 text-body text-deny">

              {error}
            </p>
          }
          <ul className="mb-4 space-y-1 text-small text-ink2">
            {[
            '올린 카드내역과 거래',
            '판정 결과',
            '되묻기 질문과 답변',
            '사업자 문진'].
            map((item) =>
            <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="text-muted">·</span>
                {item}
              </li>
            )}
          </ul>

          {me &&
          <dl className="space-y-1.5 rounded-xl bg-canvas p-4 text-small">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">가입 이메일</dt>
                <dd className="text-ink">{me.email}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">가입일</dt>
                <dd className="tabular-nums text-ink">
                  {formatFullDate(toKst(me.createdAt).date)}
                </dd>
              </div>
            </dl>
          }
        </Modal>
      </div>
    </AppShell>);

}
