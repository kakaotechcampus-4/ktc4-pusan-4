import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BugIcon, CopyIcon, MailIcon } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { Button, Modal } from './ui';
import { bugReportMailto } from '../utils/bugReport';
import { SUPPORT_EMAIL } from '../utils/contact';

/** 지금 화면·시각·브라우저·계정 id 를 채운 메일 링크. 열 때마다 시각이 새로 들어간다 */
function useMailto() {
  const { pathname } = useLocation();
  const { userId } = useSession();
  return bugReportMailto({
    path: pathname,
    at: new Date().toISOString(),
    userAgent: navigator.userAgent,
    userId
  });
}

/**
 * 받는 주소와 「주소 복사」. 메일 앱이 없으면 mailto 가 아무 일도 하지 않아 주소를 같이 둔다.
 * 버그 신고 창(BugReportButton)과 /bug-report 화면이 같이 쓴다
 */
export function BugReportAddress() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(SUPPORT_EMAIL).then(() => setCopied(true), () => setCopied(false));
  };
  return (
    <div className="text-small">
      <p className="text-ink2">받는 주소</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="break-all font-bold text-ink">{SUPPORT_EMAIL}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-3 py-1 text-caption font-bold text-ink hover:border-ink">

          <CopyIcon className="h-3 w-3" aria-hidden="true" />
          {copied ? '복사했습니다' : '주소 복사'}
        </button>
      </div>
      <p className="mt-3 leading-6 text-ink2">
        메일 쓰기를 눌러도 아무 일이 없으면 주소를 복사해 쓰는 메일에서 보내 주세요.
      </p>
    </div>);

}

/** 메일 쓰기 버튼. 제목과 본문(적을 것, 화면·시각·브라우저)을 미리 채운다 */
export function BugReportMailButton({ onClick }: {onClick?: () => void;}) {
  const href = useMailto();
  return (
    <Button href={href} size="md" onClick={onClick}>
      <MailIcon className="h-4 w-4" aria-hidden="true" />
      메일 쓰기
    </Button>);

}

/**
 * 버그 신고 창을 여는 버튼. 레포가 공개라 GitHub 이슈 대신 메일로 받는다.
 * 앱 꼬리말·내 정보·오류 화면, 공개 화면 머리말(MarketingHeader)이 쓴다
 */
export function BugReportButton({ className, label = '버그 신고', icon = true }: {className?: string;label?: string;icon?: boolean;}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? 'inline-flex items-center gap-1.5 underline-offset-4 hover:text-ink hover:underline'}>

        {icon && <BugIcon className="h-3.5 w-3.5" aria-hidden="true" />}
        {label}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="버그 신고"
        description="메일로 받습니다. 지금 화면과 시각, 브라우저를 본문에 미리 채워 둡니다."
        footer={
        <>
            <Button variant="secondary" size="md" onClick={() => setOpen(false)}>
              닫기
            </Button>
            {open && <BugReportMailButton onClick={() => setOpen(false)} />}
          </>
        }>

        <BugReportAddress />
      </Modal>
    </>);

}
