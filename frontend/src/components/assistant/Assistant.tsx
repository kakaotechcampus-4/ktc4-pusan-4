import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BotIcon, ChevronDownIcon, SendIcon, XIcon } from 'lucide-react';
import { Badge, Button, Input, cn } from '../ui';
import { useSession } from '../../contexts/SessionContext';
import { useAssistant } from './context';
import type { ChatEntry } from './context';
import { HELP_TOPICS } from './help';
import { blockedReason, MESSAGE_CHARS, PROPOSAL_LABEL } from './logic';

/** 로그인 전 메인에 서는 같은 모양의 버튼. 누르면 대화 대신 로그인으로 보낸다 */
function SignInLauncher() {
  const navigate = useNavigate();
  return (
    <div className="fixed bottom-5 right-5 z-40">
      <button
        type="button"
        onClick={() => navigate('/login', { state: { from: '/' } })}
        className="flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-body font-bold text-white shadow-panel transition-transform duration-150 ease-snap hover:-translate-y-0.5">

        <BotIcon className="h-5 w-5" aria-hidden="true" />
        Really
        <span className="sr-only">로그인하고 비서에게 묻기</span>
      </button>
    </div>);

}

/**
 * 비서 Really. 오른쪽 아래의 버튼과 대화 패널 (FR-1).
 * 비서는 제안 카드만 만들고, 바꾸는 일은 사용자가 [적용]을 눌러야 기존 API 로 일어난다.
 * 패널은 화면 위에 떠 있는 대화창이다(Modal 이 아니다). 화면을 밀지 않고 덮기 때문에 버튼은 늘 두고,
 * 다시 누르면 접는다 — 질문 카드를 가리면 바로 접고 답할 수 있게 (#143 리뷰)
 *
 * 어디에 서는지는 여기서 정한다.
 * - 로그인했으면 메인을 포함한 모든 화면. 로고로 메인에 다녀와도 버튼이 사라지지 않는다
 * - 로그인 전이면 메인에만, 그리고 로그인으로 보내는 버튼이다.
 *   `POST /assistant/chat` 은 토큰이 없으면 401 이라 대화를 열어 봐야 실패한다
 */
export function Assistant() {
  const { open, setOpen, nudge, dismissNudge, toast } = useAssistant();
  const { status } = useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);

  // 접으면 버튼으로 초점을 돌려준다
  useEffect(() => {
    if (wasOpen.current && !open) button.current?.focus();
    wasOpen.current = open;
  }, [open]);

  /*
   * 패널 밖을 누르면 접는다. 버튼은 빼 둔다 — 버튼에도 접는 일이 걸려 있어서,
   * 여기서 먼저 접으면 버튼이 다시 펴고 그대로 열려 있다.
   *
   * click 이 아니라 pointerdown 으로 듣는다. 누른 자리의 요소가 그 사이에 사라지면
   * click 때는 패널 안이었는지 밖이었는지 알 수 없다.
   * 좁은 화면에서는 패널이 화면을 다 덮어서 밖이 없다 — 그대로 둬도 달라지지 않는다
   */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panel.current?.contains(target)) return;
      if (button.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, setOpen]);

  if (status !== 'signedIn') {
    // 이어 가기를 기다리는 동안 버튼이 번쩍 나타났다 바뀌지 않게, 메인에서만 로그인 버튼을 둔다
    return pathname === '/' && status !== 'restoring' ? <SignInLauncher /> : null;
  }

  return (
    <>
      {open && <Panel onClose={() => setOpen(false)} panelRef={panel} />}
      {/* 적용 결과는 왼쪽 아래에 띄운다. 오른쪽은 패널과 버튼이 차지한다.
          좁은 화면에서 패널이 열려 있으면 아래는 입력칸이라 위로 올리고, 눌러도 뒤로 지나가게 한다 */}
      {toast &&
      <p
        role="status"
        className={cn(
          'pointer-events-none fixed bottom-5 left-5 z-50 max-w-[calc(100vw-2.5rem)] rounded-2xl bg-ink px-4 py-3 text-small leading-6 text-white shadow-panel motion-safe:animate-rise sm:max-w-sm',
          open && 'max-sm:bottom-auto max-sm:top-20'
        )}>

          {toast}
        </p>
      }
      {/* 좁은 화면에서는 패널이 화면을 다 덮으므로 버튼을 패널 안의 「접기」로 대신한다 */}
      <div className={cn('fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2', open && 'max-sm:hidden')}>
        {nudge && !open &&
        <div
          role="status"
          className="w-72 rounded-2xl border border-line bg-surface p-4 text-small text-ink2 shadow-panel motion-safe:animate-rise">

            <div className="flex items-start gap-2">
              <p className="flex-1 leading-6">{nudge.text}</p>
              <button
              type="button"
              aria-label="알림 닫기"
              onClick={dismissNudge}
              className="shrink-0 rounded-lg p-1 text-muted hover:bg-canvas hover:text-ink">

                <XIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {nudge.route &&
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => {
              if (nudge.route) navigate(nudge.route);
              dismissNudge();
            }}>

                {nudge.actionLabel ?? '보기'}
              </Button>
          }
          </div>
        }
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-body font-bold text-white shadow-panel transition-transform duration-150 ease-snap hover:-translate-y-0.5">

          {open ?
          <ChevronDownIcon className="h-5 w-5" aria-hidden="true" /> :
          <BotIcon className="h-5 w-5" aria-hidden="true" />}
          Really
          <span className="sr-only">{open ? '비서 접기' : '비서에게 묻기'}</span>
        </button>
      </div>
    </>);

}

function Panel({
  onClose,
  panelRef



}: {onClose: () => void; panelRef: React.RefObject<HTMLElement>;}) {
  const { entries, pending, error, draft, setDraft, send, showHelp, showNext } = useAssistant();
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  // 열리면 입력칸으로 초점을 옮긴다
  useEffect(() => {
    input.current?.focus();
  }, []);

  // 새 말이 오면 맨 아래로 내린다
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [entries.length, pending]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void send(draft);
  };

  // 다음에 물을 말을 늘 보인다 (#143 리뷰). 길면 가로로 넘긴다.
  // 답을 기다리는 동안에는 막는다. 그사이 붙은 문답이 기다리던 답보다 먼저 와 질문과 답이 엇갈린다
  const topics =
  <div className="flex gap-1.5 overflow-x-auto pb-1 [&>button:disabled]:cursor-not-allowed [&>button:disabled]:opacity-50 [&>button]:shrink-0">
      <button
      type="button"
      disabled={pending}
      onClick={() => void showNext()}
      className="rounded-full border border-line bg-surface px-3 py-1.5 text-caption font-bold text-ink hover:bg-canvas">

        다음에 할 일
      </button>
      {HELP_TOPICS.map((topic) =>
    <button
      key={topic.id}
      type="button"
      disabled={pending}
      onClick={() => showHelp(topic.id)}
      className="rounded-full border border-line bg-surface px-3 py-1.5 text-caption font-bold text-ink hover:bg-canvas">

          {topic.label}
        </button>
    )}
    </div>;


  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-label="비서 Really"
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-40 flex flex-col bg-surface sm:inset-auto sm:bottom-20 sm:right-5 sm:h-[min(38rem,calc(100vh-8rem))] sm:w-[25rem] sm:rounded-2xl sm:border sm:border-line sm:shadow-panel">

      <header className="flex items-start gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-bold text-ink">Really</h2>
          <p className="mt-0.5 text-caption text-muted">
            지금 화면을 보고 답합니다. 바꾸는 일은 카드의 [적용]을 눌러야 됩니다.
          </p>
        </div>
        {/* 접어도 대화는 남는다. 다시 열면 이어서 묻는다 */}
        <button
          type="button"
          aria-label="비서 접기"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-muted hover:bg-canvas hover:text-ink">

          <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-canvas px-5 py-4">
        {entries.length === 0 &&
        <div className="space-y-3">
            <p className="text-small leading-6 text-ink2">
              거래·판정·질문에 대해 물어보세요. 예: 「토요일 스타벅스는 미팅이었어」, 「3월에 카페 얼마 썼어?」
            </p>
          </div>
        }
        {entries.map((entry) => <Message key={entry.id} entry={entry} />)}
        {pending && <p className="text-small text-muted">답을 만드는 중…</p>}
        <div ref={end} />
      </div>

      <form onSubmit={submit} className="border-t border-line px-4 py-3">
        <div className="mb-2">{topics}</div>
        {error &&
        <p role="alert" className="mb-2 text-small text-deny">
            {error}
          </p>
        }
        <div className="flex items-center gap-2">
          <Input
            ref={input}
            aria-label="비서에게 물을 말"
            placeholder="물어볼 것을 적어 주세요"
            maxLength={MESSAGE_CHARS}
            value={draft}
            disabled={pending}
            onChange={(event) => setDraft(event.target.value)} />

          <Button type="submit" size="sm" disabled={pending || !draft.trim()} aria-label="보내기">
            <SendIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </form>
    </section>);

}

function Message({ entry }: {entry: ChatEntry;}) {
  const { apply } = useAssistant();
  const mine = entry.role === 'user';
  return (
    <div className={cn('flex flex-col gap-2', mine ? 'items-end' : 'items-start')}>
      <p
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-small leading-6',
          mine ? 'bg-ink text-white' : 'border border-line bg-surface text-ink2'
        )}>

        <span className="sr-only">{mine ? '나: ' : 'Really: '}</span>
        {entry.content}
      </p>
      {entry.proposals.map((item, index) => {
        const blocked = blockedReason(item.proposal);
        // 적용한 카드는 한 줄로 접는다. 무엇을 했는지만 남긴다 (#143 리뷰)
        if (item.state === 'done')
        return (
          <p key={item.key} className="w-full rounded-xl border border-line2 bg-surface px-3.5 py-2 text-caption text-muted">
                <Badge>{PROPOSAL_LABEL[item.proposal.kind]}</Badge> <span className="ml-1">적용함 · {item.result}</span>
              </p>);

        return (
          <div key={item.key} className="w-full rounded-2xl border border-line bg-surface p-3.5">
            <Badge>{PROPOSAL_LABEL[item.proposal.kind]}</Badge>
            <p className="mt-2 text-small font-normal text-ink">{item.proposal.card}</p>
            {blocked ?
            <p className="mt-2 text-caption text-muted">{blocked}</p> :

            <div className="mt-3 flex items-center gap-3">
                <Button
                size="sm"
                className="shrink-0"
                disabled={item.state === 'busy'}
                onClick={() => void apply(entry.id, index)}>

                  {item.state === 'busy' ? '적용 중…' : '적용'}
                </Button>
                {item.result &&
              <p
                role={item.state === 'failed' ? 'alert' : 'status'}
                className={cn('text-caption', item.state === 'failed' ? 'text-deny' : 'text-ink2')}>

                    {item.result}
                  </p>
              }
              </div>
            }
          </div>);

      })}
    </div>);

}
