import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircleIcon, SendIcon, XIcon } from 'lucide-react';
import { Badge, Button, Input, cn } from '../ui';
import { useAssistant } from './context';
import type { ChatEntry } from './context';
import { HELP_TOPICS } from './help';
import { blockedReason, MESSAGE_CHARS, PROPOSAL_LABEL } from './logic';

/** 패널 자리(right-5 + w-[25rem])에 화면과의 사이 1.5rem 을 더한 폭 */
const PANEL_SPACE = '27.75rem';
/** 패널을 비켜도 화면이 남는 폭. 이보다 좁으면 패널이 화면 위에 뜬다 */
const WIDE = '(min-width: 1024px)';

/**
 * 비서 Really. 로그인 뒤 모든 화면 오른쪽 아래의 버튼과 대화 패널 (FR-1).
 * 비서는 제안 카드만 만들고, 바꾸는 일은 사용자가 [적용]을 눌러야 기존 API 로 일어난다.
 * 패널은 화면을 가리지 않는 대화창이라 Modal 이 아니다 — 열어 둔 채로 화면을 쓸 수 있다
 */
export function Assistant() {
  const { open, setOpen, nudge, dismissNudge } = useAssistant();
  const navigate = useNavigate();
  const button = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // 닫으면 버튼으로 초점을 돌려준다
  useEffect(() => {
    if (wasOpen.current && !open) button.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // 넓은 화면에서 패널을 열면 오른쪽에 패널 폭만큼 여백을 준다. 가운데 놓인 화면이 왼쪽으로 비켜,
  // 열어 둔 채로 답할 선택지를 가리지 않는다
  useEffect(() => {
    if (!open) return;
    const wide = window.matchMedia(WIDE);
    const place = () => {
      document.body.style.paddingRight = wide.matches ? PANEL_SPACE : '';
    };
    place();
    wide.addEventListener('change', place);
    return () => {
      wide.removeEventListener('change', place);
      document.body.style.paddingRight = '';
    };
  }, [open]);

  if (open) return <Panel onClose={() => setOpen(false)} />;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      {nudge &&
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
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-body font-bold text-white shadow-panel transition-transform duration-150 ease-snap hover:-translate-y-0.5">

        <MessageCircleIcon className="h-5 w-5" aria-hidden="true" />
        Really
        <span className="sr-only">비서에게 묻기</span>
      </button>
    </div>);

}

function Panel({ onClose }: {onClose: () => void;}) {
  const { entries, pending, error, draft, setDraft, send, showHelp, showNext } = useAssistant();
  const [helpOpen, setHelpOpen] = useState(false);
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

  // 답을 기다리는 동안에는 막는다. 그사이 붙은 문답이 기다리던 답보다 먼저 와 질문과 답이 엇갈린다
  const topics =
  <div className="flex flex-wrap gap-1.5 [&>button:disabled]:cursor-not-allowed [&>button:disabled]:opacity-50">
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
      role="dialog"
      aria-label="비서 Really"
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-40 flex flex-col bg-surface sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(40rem,calc(100vh-6rem))] sm:w-[25rem] sm:rounded-2xl sm:border sm:border-line sm:shadow-panel">

      <header className="flex items-start gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-bold text-ink">Really</h2>
          <p className="mt-0.5 text-caption text-muted">
            지금 화면을 보고 답합니다. 바꾸는 일은 카드의 [적용]을 눌러야 됩니다.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={helpOpen}
          onClick={() => setHelpOpen((value) => !value)}
          className="shrink-0 rounded-lg px-2 py-1 text-caption font-bold text-ink2 hover:bg-canvas">

          도움말
        </button>
        <button
          type="button"
          aria-label="비서 닫기"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-muted hover:bg-canvas hover:text-ink">

          <XIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {helpOpen && entries.length > 0 &&
      <div className="border-b border-line bg-canvas px-5 py-3">{topics}</div>
      }

      <div role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-canvas px-5 py-4">
        {entries.length === 0 &&
        <div className="space-y-3">
            <p className="text-small leading-6 text-ink2">
              거래·판정·질문에 대해 물어보세요. 예: 「토요일 스타벅스는 미팅이었어」, 「3월에 카페 얼마 썼어?」
            </p>
            {topics}
          </div>
        }
        {entries.map((entry) => <Message key={entry.id} entry={entry} />)}
        {pending && <p className="text-small text-muted">답을 만드는 중…</p>}
        <div ref={end} />
      </div>

      <form onSubmit={submit} className="border-t border-line px-4 py-3">
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
                variant={item.state === 'done' ? 'secondary' : 'primary'}
                disabled={item.state === 'busy' || item.state === 'done'}
                onClick={() => void apply(entry.id, index)}>

                  {item.state === 'busy' ? '적용 중…' : item.state === 'done' ? '적용함' : '적용'}
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
