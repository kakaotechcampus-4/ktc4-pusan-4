import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { BugReportButton } from '../components/BugReport';
import { api, ApiRequestError, useApi } from '../api';
import { useSession } from '../contexts/SessionContext';
import { Button, Card, Modal, SectionHeading } from '../components/ui';
import { formatFullDate, formatNumber, toKst } from '../utils/format';
import { accountLabel } from '../utils/account';
import { contextRows } from '../utils/context';

const SECTION = 'overflow-hidden rounded-2xl border border-line bg-surface';
const SECTION_TITLE = 'flex items-center justify-between gap-3 border-b border-line2 px-5 py-3';

/**
 * 내 정보 (마이페이지, FR-02·03). 계정과 사업자 문진, 내 자료로 가는 길, 도움말, 탈퇴.
 * 비밀번호 바꾸기와 계정 연결은 BE API 가 생기면 붙인다
 */
export function Account() {
  const navigate = useNavigate();
  const { signOut, context } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meQ = useApi(() => api.users.me(), []);
  const me = meQ.data;
  // 몇 건 올렸는지만 본다
  const uploadsQ = useApi(() => api.uploads.list({ size: 1 }), []);

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

  const kakao = me !== null && me !== undefined && me.email === null;
  const accountRows = me ?
  [
  { term: '로그인 방식', value: kakao ? '카카오' : '이메일' },
  ...(me.email ? [{ term: '가입 이메일', value: me.email }] : []),
  { term: '가입일', value: formatFullDate(toKst(me.createdAt).date) }] :
  [];

  const uploadCount = uploadsQ.data?.page.totalElements;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <SectionHeading
          eyebrow="설정"
          title="내 정보"
          description="계정과 사업자 문진을 확인하고, 탈퇴할 수 있습니다." />

        <section className={`mt-6 ${SECTION}`}>
          <div className={SECTION_TITLE}>
            <h2 className="text-body font-bold text-ink">계정</h2>
          </div>
          <dl className="divide-y divide-line2">
            {accountRows.length === 0 &&
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
            {accountRows.map((row) =>
            <div key={row.term} className="flex gap-4 px-5 py-3">
                <dt className="w-32 shrink-0 text-small text-muted">{row.term}</dt>
                <dd className="text-small font-normal text-ink">{row.value}</dd>
              </div>
            )}
          </dl>
          {kakao &&
          <p className="border-t border-line2 px-5 py-3 text-caption leading-5 text-muted">
              카카오 계정은 이메일 계정과 따로입니다. 같은 이메일로 가입한 계정이 있어도 판정 이력은 합쳐지지 않습니다.
            </p>
          }
        </section>

        <section className={`mt-4 ${SECTION}`}>
          <div className={SECTION_TITLE}>
            <h2 className="text-body font-bold text-ink">사업자 문진</h2>
            <Button to="/interview" variant="ghost" size="sm">
              {context ? '문진 고치기' : '문진 하기'}
            </Button>
          </div>
          {context ?
          <dl className="divide-y divide-line2">
              {contextRows(context).map((row) =>
            <div key={row.term} className="flex gap-4 px-5 py-3">
                  <dt className="w-32 shrink-0 text-small text-muted">{row.term}</dt>
                  <dd className="text-small font-normal text-ink">{row.value}</dd>
                </div>
            )}
            </dl> :

          <p className="px-5 py-4 text-small text-muted">
              아직 문진을 하지 않았습니다. 판정을 시작하기 전에 마치면 됩니다.
            </p>
          }
          {context &&
          <p className="border-t border-line2 px-5 py-3 text-caption leading-5 text-muted">
              고치면 새 버전으로 저장됩니다. 이미 낸 판정은 그때 문진 버전을 그대로 기록해 둡니다.
            </p>
          }
        </section>

        <section className={`mt-4 ${SECTION}`}>
          <div className={SECTION_TITLE}>
            <h2 className="text-body font-bold text-ink">내 자료</h2>
          </div>
          <ul className="divide-y divide-line2 text-small">
            <li>
              <Link to="/uploads" className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                <span className="text-ink">업로드 이력</span>
                <span className="flex items-center gap-2 tabular-nums text-muted">
                  {uploadCount !== undefined && `${formatNumber(uploadCount)}건`}
                  <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            </li>
            <li>
              <Link to="/transactions" className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                <span className="text-ink">거래 목록</span>
                <ArrowRightIcon className="h-4 w-4 text-muted" aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </section>

        <section className={`mt-4 ${SECTION}`}>
          <div className={SECTION_TITLE}>
            <h2 className="text-body font-bold text-ink">도움말</h2>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 px-5 py-4 text-small text-ink2">
            <li><Link to="/faq" className="underline-offset-4 hover:text-ink hover:underline">자주 묻는 질문</Link></li>
            <li><Link to="/terms" className="underline-offset-4 hover:text-ink hover:underline">이용약관</Link></li>
            <li><Link to="/privacy" className="font-bold underline-offset-4 hover:text-ink hover:underline">개인정보처리방침</Link></li>
            <li><BugReportButton /></li>
          </ul>
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
          </div>
        </Card>

        <Modal
          open={confirming}
          onClose={() => setConfirming(false)}
          tone="danger"
          title="정말 탈퇴할까요?"
          description={`되돌릴 수 없습니다. 이 ${kakao ? '카카오 계정' : '이메일'}로 다시 로그인할 수 없고, 아래 데이터가 함께 사라집니다.`}
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
                <dt className="text-muted">계정</dt>
                <dd className="text-ink">{accountLabel(me.email)}</dd>
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
