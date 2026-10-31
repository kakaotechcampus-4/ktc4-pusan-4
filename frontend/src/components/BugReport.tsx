import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BugIcon, CopyIcon } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { Button, Modal } from './ui';
import { bugReportMailto } from '../utils/bugReport';
import { SUPPORT_EMAIL } from '../utils/contact';

/**
 * 버그 신고. 레포가 공개라 GitHub 이슈 대신 메일로 받는다. 메일 앱이 없으면 mailto 가 아무 일도 하지 않아
 * 받는 주소와 「주소 복사」를 같이 둔다
 */
export function BugReportButton({ className }: {className?: string;}) {
  const { pathname } = useLocation();
  const { userId } = useSession();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const href = bugReportMailto({
    path: pathname,
    at: new Date().toISOString(),
    userAgent: navigator.userAgent,
    userId
  });

  const copy = () => {
    void navigator.clipboard?.writeText(SUPPORT_EMAIL).then(() => setCopied(true), () => setCopied(false));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCopied(false);
          setOpen(true);
        }}
        className={className ?? 'inline-flex items-center gap-1.5 underline-offset-4 hover:text-ink hover:underline'}>
        
        <BugIcon className="h-3.5 w-3.5" aria-hidden="true" />
        버그 신고
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
            <Button href={href} size="md" onClick={() => setOpen(false)}>
              메일 쓰기
            </Button>
          </>
        }>
        
        <div className="rounded-xl bg-canvas p-4 text-small">
          <p className="text-muted">받는 주소</p>
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
          <p className="mt-3 leading-6 text-muted">
            「메일 쓰기」를 눌러도 아무 일이 없으면 메일 앱이 설정되지 않은 것입니다. 주소를 복사해 쓰는 메일에서 보내
            주세요. 어느 화면에서 무엇을 하다 생긴 문제인지 적어 주시면 빨리 찾을 수 있습니다.
          </p>
        </div>
      </Modal>
    </>);

}
