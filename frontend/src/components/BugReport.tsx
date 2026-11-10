import React, { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BugIcon, CheckIcon, CopyIcon, MailIcon } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { api, ApiRequestError, lastErrorTraceId } from '../api';
import { rememberTraceId } from '../api/contract';
import { Button, IconButton, Modal } from './ui';
import { bugReportMailto, cutText } from '../utils/bugReport';
import { SUPPORT_EMAIL } from '../utils/contact';

/** 서버가 받는 길이 (api.md 3.16) */
const MESSAGE_LIMIT = 2000;
const USER_AGENT_LIMIT = 500;
const URL_LIMIT = 2000;

const SEND_ERRORS: Record<string, string> = {
  VALIDATION_ERROR: '무엇이 잘못됐는지 적어 주세요.',
  BUG_REPORT_RATE_LIMITED: '한 시간에 5건까지 받습니다. 잠시 뒤 다시 보내 주세요.',
  BUG_REPORT_SEND_FAILED: '보내지 못했습니다. 잠시 뒤 다시 보내 주세요.'
};

/**
 * 버그 신고를 어떻게 받을지.
 * form: 로그인한 사람은 서비스 안에서 보낸다(POST /bug-reports). sent: 보냈다.
 * mail: 로그인 전이거나 서버에 메일 계정이 없으면(503) 지금처럼 메일 주소를 보인다
 */
type Mode = 'form' | 'sent' | 'mail';

/** 신고 폼의 상태와 보내기. 창(BugReportButton)과 /bug-report 화면이 같이 쓴다 */
function useBugReportForm() {
  const { status } = useSession();
  const [unavailable, setUnavailable] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  const formId = useId();

  const mode: Mode = status !== 'signedIn' || unavailable ? 'mail' : sent ? 'sent' : 'form';

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (sending.current) return;
    if (!message.trim()) {
      setError(SEND_ERRORS.VALIDATION_ERROR);
      return;
    }
    sending.current = true;
    setBusy(true);
    setError(null);
    void api.bugReports.
    create({
      message: message.trim(),
      // 도메인은 뻔해서 뺀다. 어느 업로드, 어느 판정인지는 쿼리에 있어 남긴다
      pageUrl: (window.location.pathname + window.location.search).slice(0, URL_LIMIT),
      userAgent: navigator.userAgent.slice(0, USER_AGENT_LIMIT),
      // 마지막으로 받은 오류 응답의 traceId. 서버 로그와 바로 잇는다 (#225)
      traceId: lastErrorTraceId() ?? undefined
    }).
    then(
      () => {
        setSent(true);
        setMessage('');
        // 이 오류는 신고했다. 다음 신고에 다시 싣지 않는다
        rememberTraceId(null);
      },
      (caught: unknown) => {
        const code = caught instanceof ApiRequestError ? caught.code : '';
        // 적은 글은 지우지 않는다. 메일 본문에 옮겨 준다
        if (code === 'BUG_REPORT_UNAVAILABLE') {
          setUnavailable(true);
          return;
        }
        setError(
          caught instanceof ApiRequestError && caught.status === 0 ?
          '서버에 연결하지 못했습니다. 잠시 뒤 다시 보내 주세요.' :
          // 서버가 남은 시간(「N분 뒤에 다시 보내 주세요.」)을 준다. 없으면 고정 문구를 쓴다
          code === 'BUG_REPORT_RATE_LIMITED' && caught instanceof ApiRequestError && /\d+분/.test(caught.message) ?
          `한 시간에 5건까지 받습니다. ${caught.message}` :
          SEND_ERRORS[code] ?? SEND_ERRORS.BUG_REPORT_SEND_FAILED
        );
      }
    ).
    finally(() => {
      sending.current = false;
      setBusy(false);
    });
  };

  /** 창을 닫았다 다시 열면 새 신고를 쓴다 */
  const reset = () => {
    setSent(false);
    setError(null);
  };

  /** 고쳐 적기 시작하면 「적어 주세요」 같은 오류는 걷는다 */
  const write = (value: string) => {
    setMessage(value);
    setError(null);
  };

  return { mode, message, setMessage: write, busy, error, submit, reset, formId };
}

/** 적는 칸. 보내기 버튼은 부르는 쪽이 form 속성으로 잇는다 */
function BugReportFields({ form }: {form: ReturnType<typeof useBugReportForm>;}) {
  const fieldId = useId();
  return (
    <form id={form.formId} onSubmit={form.submit} noValidate>
      <label htmlFor={fieldId} className="block text-small text-ink2">
        무엇을 하려다 무엇을 봤는지
      </label>
      <div className="field-box mt-1.5 rounded-xl border border-edge bg-canvas pb-1 pr-1">
        <textarea
          id={fieldId}
          value={form.message}
          onChange={(event) => form.setMessage(cutText(event.target.value, MESSAGE_LIMIT))}
          rows={6}
          placeholder="예: 결과 화면에서 금액이 0원으로 나와요"
          aria-invalid={form.error !== null}
          aria-describedby={form.error ? `${fieldId}-error` : undefined}
          className="block w-full resize-y rounded-xl border-0 bg-transparent px-3.5 py-2.5 text-[14px] leading-6 text-ink placeholder:text-muted" />
      </div>

      {form.error &&
      <p id={`${fieldId}-error`} role="alert" className="mt-1.5 text-[13px] text-deny">
          {form.error}
        </p>
      }
    </form>);

}

/**
 * 지금 화면·시각·브라우저·계정 id 를 채운 메일 링크. 열 때마다 시각이 새로 들어간다.
 * message: 서비스 안에서 보내려다 메일로 넘어왔으면 그때 적은 글
 */
function useMailto(message?: string) {
  const { pathname } = useLocation();
  const { userId } = useSession();
  return bugReportMailto({
    path: pathname,
    at: new Date().toISOString(),
    userAgent: navigator.userAgent,
    userId,
    message: message?.trim() || undefined,
    traceId: lastErrorTraceId() ?? undefined
  });
}

/**
 * 받는 주소와 「주소 복사」. 메일 앱이 없으면 mailto 가 아무 일도 하지 않아 주소를 같이 둔다.
 * 버그 신고 창(BugReportButton)과 /bug-report 화면이 같이 쓴다
 */
export function BugReportAddress() {
  const [copied, setCopied] = useState(false);
  // 확인 표시는 잠깐만 둔다. 계속 두면 다시 복사해도 바뀌는 게 없다
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copy = () => {
    // 2초 안에 다시 복사해도 알리도록 한 번 걷었다가 다시 띄운다
    setCopied(false);
    void navigator.clipboard?.writeText(SUPPORT_EMAIL).then(() => setCopied(true), () => setCopied(false));
  };
  return (
    <div className="text-small">
      <p className="text-ink2">받는 주소</p>
      {/* 복사 그림은 주소 바로 옆에 둔다. 그림만 바뀌면 화면 읽기가 알 수 없어 status 로 알린다 */}
      <div className="mt-1 flex items-center gap-2">
        <span className="break-all font-bold text-ink">{SUPPORT_EMAIL}</span>
        <IconButton
          icon={copied ? CheckIcon : CopyIcon}
          label={copied ? '복사했습니다' : '주소 복사'}
          onClick={copy} />
        <span role="status" className="sr-only">{copied ? '주소를 복사했습니다' : ''}</span>
      </div>
      <p className="mt-3 leading-6 text-ink2">
        메일 쓰기를 눌러도 아무 일이 없으면 주소를 복사해 쓰는 메일에서 보내 주세요.
      </p>
    </div>);

}

/** 메일 쓰기 버튼. 제목과 본문(적을 것, 화면·시각·브라우저)을 미리 채운다 */
export function BugReportMailButton({ onClick, message }: {onClick?: () => void;message?: string;}) {
  const href = useMailto(message);
  return (
    <Button href={href} size="md" onClick={onClick}>
      <MailIcon className="h-4 w-4" aria-hidden="true" />
      메일 쓰기
    </Button>);

}

/**
 * 버그 신고 창을 여는 버튼. 로그인했으면 창에서 바로 보내고, 아니면 메일로 받는다(레포가 공개라 GitHub 이슈는 쓰지 않는다).
 * 앱 꼬리말·내 정보·오류 화면, 공개 화면 머리말(MarketingHeader)이 쓴다
 */
export function BugReportButton({ className, label = '버그 신고', icon = true }: {className?: string;label?: string;icon?: boolean;}) {
  const [open, setOpen] = useState(false);
  const form = useBugReportForm();
  const close = () => {
    setOpen(false);
    form.reset();
  };
  /*
   * 보냈거나 메일로 넘어가면 보내기 버튼이 사라져 초점이 창 밖(body)으로 떨어진다. 바뀐 내용으로 옮긴다.
   * 창을 처음 열 때의 초점은 Modal 이 잡는다
   */
  const body = useRef<HTMLDivElement>(null);
  const shown = useRef(form.mode);
  useEffect(() => {
    if (open && shown.current !== form.mode) body.current?.focus();
    shown.current = form.mode;
  }, [open, form.mode]);

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
        onClose={close}
        title="버그 신고"
        description={form.mode === 'mail' ? '메일로 받습니다.' : undefined}
        footer={
        <>
            <Button variant="secondary" size="md" onClick={close}>
              닫기
            </Button>
            {open && form.mode === 'mail' && <BugReportMailButton onClick={close} message={form.message} />}
            {form.mode === 'form' &&
          <Button type="submit" form={form.formId} size="md" disabled={form.busy}>
                {form.busy ? '보내는 중…' : '보내기'}
              </Button>
          }
          </>
        }>

        <div ref={body} tabIndex={-1} className="outline-none">
          {form.mode === 'mail' && <BugReportAddress />}
          {form.mode === 'form' && <BugReportFields form={form} />}
          {form.mode === 'sent' &&
          <p role="status" className="text-body text-ink">
              감사합니다.
            </p>
          }
        </div>
      </Modal>
    </>);

}

/** /bug-report 화면의 신고 칸. 로그인 전이거나 메일 계정이 없는 서버면 메일 안내를 보인다 */
export function BugReportPanel() {
  const form = useBugReportForm();
  // 보냈거나 메일로 넘어가면 보내기 버튼이, 새로 보내면 그 버튼이 사라져 초점이 body 로 떨어진다. 바뀐 첫 줄이나 적는 칸으로 옮긴다
  const status = useRef<HTMLParagraphElement>(null);
  const shown = useRef(form.mode);
  useEffect(() => {
    if (shown.current !== form.mode)
    (form.mode === 'form' ? document.getElementById(form.formId)?.querySelector('textarea') : status.current)?.focus();
    shown.current = form.mode;
  }, [form.mode, form.formId]);

  if (form.mode === 'mail')
  return (
    <>
        <p ref={status} tabIndex={-1} className="text-h4 font-bold text-ink outline-none">메일로 받습니다</p>
        <div className="mt-6">
          <BugReportMailButton message={form.message} />
        </div>
        <div className="mt-6">
          <BugReportAddress />
        </div>
      </>);

  if (form.mode === 'sent')
  return (
    <>
        <p ref={status} tabIndex={-1} role="status" className="text-h4 font-bold text-ink outline-none">
          감사합니다.
        </p>
        <Button variant="secondary" size="md" className="mt-6" onClick={form.reset}>
          새로 보내기
        </Button>
      </>);

  return (
    <>
      <BugReportFields form={form} />
      <Button type="submit" form={form.formId} size="md" className="mt-4" disabled={form.busy}>
        {form.busy ? '보내는 중…' : '보내기'}
      </Button>
    </>);

}
