import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  CalendarRangeIcon,
  FolderOpenIcon,
  HistoryIcon,
  KeyRoundIcon,
  ListIcon,
  LogOutIcon,
  PencilIcon,
  UserRoundIcon } from
'lucide-react';
import { AppShell } from '../components/AppShell';
import { InfoPanel, InfoRows, PANEL_BODY, PANEL_ICON, PanelFailed, PanelNote } from '../components/InfoPanel';
import { api, ApiRequestError, useApi } from '../api';
import { useSession } from '../contexts/SessionContext';
import { Button, IconButton, Modal, cn } from '../components/ui';
import { formatFullDate } from '../utils/format';
import { accountLabel } from '../utils/account';
import { contextRows } from '../utils/context';
import { PasswordChange } from '../components/PasswordChange';

/**
 * 내 정보 (FR-02·03). 계정과 사업자 문진, 내 자료로 가는 길, 비밀번호, 탈퇴.
 * 계정 연결은 BE API 가 생기면 붙인다
 */
/** 내 자료 상자의 줄. 그림은 화면마다 하나다 */
const MY_DATA = [
{ to: '/yearly', label: '연간 결과', icon: CalendarRangeIcon },
{ to: '/uploads', label: '업로드 이력', icon: HistoryIcon },
{ to: '/transactions', label: '거래', icon: ListIcon }];


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
    <AppShell disclaimer={false} narrow>
      <div>
        <header>
          <h1 className="text-h2 font-bold tracking-tight text-ink">내 정보</h1>
        </header>

        <InfoPanel title="계정" icon={UserRoundIcon}>
          {meQ.loading && !me && <PanelNote>불러오는 중</PanelNote>}
          {!meQ.loading && !me &&
          <PanelFailed onRetry={meQ.reload}>가입 정보를 불러오지 못했습니다.</PanelFailed>
          }
          {me && <InfoRows rows={accountRows} />}
        </InfoPanel>

        <InfoPanel
          title="사업자 문진"
          icon={BriefcaseBusinessIcon}
          action={
          contextStatus === 'ready' || contextStatus === 'none' ?
          <IconButton
            to="/interview"
            state={{ from: '/account' }}
            icon={PencilIcon}
            className={PANEL_ICON}
            label={contextStatus === 'ready' ? '문진 고치기' : '문진 하기'} /> :
          null
          }>

          {contextStatus === 'loading' && <PanelNote>불러오는 중</PanelNote>}
          {/* 못 읽은 것을 문진 전으로 그리지 않는다 (C57) */}
          {contextStatus === 'error' && <PanelFailed onRetry={reloadContext}>문진을 불러오지 못했습니다.</PanelFailed>}
          {contextStatus === 'none' && <PanelNote>아직 문진을 하지 않았습니다.</PanelNote>}
          {contextStatus === 'ready' && context && <InfoRows rows={contextRows(context)} />}
        </InfoPanel>

        <InfoPanel title="내 자료" icon={FolderOpenIcon}>
          {/* 올린 파일을 합쳐 한 해 단위로 본다. 파일 하나를 따라가는 판정 흐름(단계 띠)과 섞지 않는다 */}
          <ul className="px-2.5 pb-2.5 pt-0.5 text-body">
            {MY_DATA.map(({ to, label, icon: Icon }) =>
            <li key={to}>
                <Link to={to} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-ink transition-colors duration-150 hover:bg-surface">
                  <Icon className="h-[18px] w-[18px] shrink-0 text-ink2" aria-hidden="true" />
                  {label}
                  <ArrowRightIcon className="ml-auto h-4 w-4 text-ink2" aria-hidden="true" />
                </Link>
              </li>
            )}
          </ul>
        </InfoPanel>

        {/* 위의 상자들과 같은 모양으로 둔다. 제목 크기가 다르면 다른 종류의 내용처럼 읽힌다 */}
        {me &&
        <InfoPanel title="비밀번호" icon={KeyRoundIcon}>
            <div className={cn(PANEL_BODY, 'pb-5 pt-1')}>
              <PasswordChange email={me.email} />
            </div>
          </InfoPanel>
        }

        <InfoPanel title="탈퇴" icon={LogOutIcon} tone="danger">
          <div className={cn(PANEL_BODY, 'pb-5 pt-1')}>
            <p className="text-small leading-6 text-ink">
              탈퇴하면 계정과 함께 올린 카드내역과 거래, 판정 결과, 질문과 답변, 사업자 문진이 모두
              사라집니다. 되돌릴 수 없습니다.
            </p>
            {/* 계정을 지우는 것은 되돌릴 수 없어 빨강이다(11/8 회의). 확인 창에서 한 번 더 묻는다 */}
            <Button
              variant="danger"
              size="md"
              className="mt-4"
              disabled={!me}
              onClick={() => setConfirming(true)}>

              탈퇴하기
            </Button>
          </div>
        </InfoPanel>

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

                {removing ? '탈퇴하는 중' : '탈퇴하기'}
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
