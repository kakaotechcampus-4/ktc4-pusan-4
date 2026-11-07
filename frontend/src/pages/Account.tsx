import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { InfoPanel, InfoRows, PANEL_LINK, PanelFailed, PanelNote } from '../components/InfoPanel';
import { api, ApiRequestError, useApi } from '../api';
import { useSession } from '../contexts/SessionContext';
import { Button, Modal } from '../components/ui';
import { formatFullDate } from '../utils/format';
import { accountLabel } from '../utils/account';
import { contextRows } from '../utils/context';

/**
 * 내 정보 (FR-02·03). 계정과 사업자 문진, 내 자료로 가는 길, 탈퇴.
 * 비밀번호 바꾸기와 계정 연결은 BE API 가 생기면 붙인다
 */
export function Account() {
  const navigate = useNavigate();
  const { signOut, context, contextStatus, reloadContext } = useSession();
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

  const kakao = me !== null && me !== undefined && me.email === null;
  const accountRows = me ?
  [
  { term: '로그인 방식', value: kakao ? '카카오' : '이메일' },
  ...(me.email ? [{ term: '가입 이메일', value: me.email }] : []),
  { term: '가입일', value: formatFullDate(me.createdAt) }] :
  [];

  return (
    // 고지 막대를 내린다. 여기엔 세무대리로 오인할 판정 내용이 없다 (#242 리뷰)
    <AppShell disclaimer={false}>
      <div className="max-w-2xl">
        <header>
          <h1 className="text-h2 font-bold tracking-tight text-ink">내 정보</h1>
        </header>

        <InfoPanel title="계정">
          {meQ.loading && !me && <PanelNote>불러오는 중…</PanelNote>}
          {!meQ.loading && !me &&
          <PanelFailed onRetry={meQ.reload}>가입 정보를 불러오지 못했습니다.</PanelFailed>
          }
          {me && <InfoRows rows={accountRows} />}
        </InfoPanel>

        <InfoPanel
          title="사업자 문진"
          action={
          contextStatus === 'ready' ?
          <Link to="/interview" state={{ from: '/account' }} className={PANEL_LINK}>문진 고치기</Link> :
          contextStatus === 'none' ?
          <Link to="/interview" state={{ from: '/account' }} className={PANEL_LINK}>문진 하기</Link> :
          null
          }>

          {contextStatus === 'loading' && <PanelNote>불러오는 중…</PanelNote>}
          {/* 못 읽은 것을 문진 전으로 그리지 않는다 (C57) */}
          {contextStatus === 'error' && <PanelFailed onRetry={reloadContext}>문진을 불러오지 못했습니다.</PanelFailed>}
          {contextStatus === 'none' && <PanelNote>아직 문진을 하지 않았습니다.</PanelNote>}
          {contextStatus === 'ready' && context && <InfoRows rows={contextRows(context)} />}
        </InfoPanel>

        <InfoPanel title="내 자료">
          <ul className="divide-y divide-line text-small">
            <li>
              <Link to="/uploads" className="flex items-center justify-between gap-3 px-5 py-3 text-ink hover:bg-surface">
                업로드 이력
                <ArrowRightIcon className="h-4 w-4 text-ink2" aria-hidden="true" />
              </Link>
            </li>
            <li>
              <Link to="/transactions" className="flex items-center justify-between gap-3 px-5 py-3 text-ink hover:bg-surface">
                거래
                <ArrowRightIcon className="h-4 w-4 text-ink2" aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </InfoPanel>

        <section className="mt-10">
          <h2 className="text-h4 font-bold text-ink">탈퇴</h2>
          <p className="mt-1.5 text-body leading-6 text-ink">
            탈퇴하면 계정과 함께 올린 카드내역과 거래, 판정 결과, 질문과 답변, 사업자 문진이 모두
            사라집니다. 되돌릴 수 없습니다.
          </p>
          <Button
            variant="danger"
            size="md"
            className="mt-4"
            disabled={!me}
            onClick={() => setConfirming(true)}>

            탈퇴하기
          </Button>
        </section>

        <Modal
          open={confirming}
          onClose={() => setConfirming(false)}
          tone="danger"
          title="정말 탈퇴하시겠습니까?"
          description={
          kakao ?
          // 카카오 로그인은 처음 보는 회원번호면 계정을 새로 만든다(#176). 막히는 것이 아니라 빈 계정으로 다시 시작한다
          '되돌릴 수 없습니다. 아래 데이터가 함께 사라지고, 같은 카카오 계정으로 다시 로그인하면 빈 새 계정으로 시작합니다.' :
          '되돌릴 수 없습니다. 이 이메일로 다시 로그인할 수 없고, 아래 데이터가 함께 사라집니다.'
          }
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
          <p role="alert" className="mb-4 text-body text-deny">
              {error}
            </p>
          }
          <ul className="mb-4 list-disc space-y-1 pl-5 text-small text-ink">
            {['올린 카드내역과 거래', '판정 결과', '질문과 답변', '사업자 문진'].map((item) =>
            <li key={item}>{item}</li>
            )}
          </ul>

          {/* 어느 계정을 지우는지 한 번 더 보인다. 다른 탭에서 계정이 바뀌었을 수 있다 */}
          {me &&
          <dl className="space-y-1.5 rounded-xl border border-line p-4 text-small">
              <div className="flex justify-between gap-3">
                <dt className="text-ink2">계정</dt>
                <dd className="text-ink">{accountLabel(me.email)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink2">가입일</dt>
                <dd className="tabular-nums text-ink">
                  {formatFullDate(me.createdAt)}
                </dd>
              </div>
            </dl>
          }
        </Modal>
      </div>
    </AppShell>);

}
