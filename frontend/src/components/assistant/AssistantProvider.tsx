import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, invalidateAll } from '../../api';
import type { AssistantProposal } from '../../types/domain';
import { useSession } from '../../contexts/SessionContext';
import { AssistantContext } from './context';
import type { AssistantValue, ChatEntry, Nudge, ProposalEntry } from './context';
import { HELP_TOPICS } from './help';
import { applyErrorText, applyProposal, chatErrorText, historyOf, MESSAGE_CHARS, routeName } from './logic';

const entryId = () => crypto.randomUUID();

/** 귀속연도. 서비스는 2026 귀속만 다룬다(머리글의 「귀속 2026년」). 비서의 연간 요약이 이 값으로 범위를 잡는다 */
const TAX_YEAR = 2026;

/**
 * 비서 Really 의 대화 상태. 라우트 바깥에 한 번만 올려 두어, 화면을 옮기거나 랜딩에 다녀와도 대화가 이어진다(FR-1).
 * 계정이 바뀌면 다시 올라가 대화가 사라진다(App 의 key). 서버는 대화를 저장하지 않는다(C-12)
 */
export function AssistantProvider({ children }: {children: React.ReactNode;}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { batchId } = useSession();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const sessionId = useRef(crypto.randomUUID());
  const nudged = useRef(new Set<string>());
  // 보낼 때의 대화. 상태를 읽으려고 send 를 매번 새로 만들지 않는다
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const toEntries = (proposals: AssistantProposal[]): ProposalEntry[] =>
  proposals.map((proposal) => ({ proposal, key: crypto.randomUUID(), state: 'idle' }));

  const send = useCallback(async (text: string) => {
    const message = text.trim().slice(0, MESSAGE_CHARS);
    if (!message || pending) return;
    const history = historyOf(entriesRef.current);
    const mine: ChatEntry = { id: entryId(), role: 'user', content: message, proposals: [] };
    setEntries((prev) => [...prev, mine]);
    setPending(true);
    setError(null);
    setDraft('');
    try {
      const reply = await api.assistant.chat({
        message,
        history,
        context: { screen: pathname, batchId, transactionId: subject, year: TAX_YEAR },
        sessionId: sessionId.current
      });
      setEntries((prev) => [
      ...prev,
      { id: entryId(), role: 'assistant', content: reply.answer, proposals: toEntries(reply.proposals) }]
      );
    } catch (caught) {
      // 못 보낸 말은 대화에서 빼고 입력칸으로 돌려준다. 고쳐서 다시 보낼 수 있게
      setEntries((prev) => prev.filter((entry) => entry.id !== mine.id));
      setDraft(message);
      setError(chatErrorText(caught));
    } finally {
      setPending(false);
    }
  }, [pending, pathname, batchId, subject]);

  // 비서의 답을 기다리는 동안에는 받지 않는다. 그사이 넣은 문답이 먼저 붙어 질문과 답이 엇갈린다
  const showHelp = useCallback((topicId: string) => {
    const topic = HELP_TOPICS.find((item) => item.id === topicId);
    if (!topic || pending) return;
    setEntries((prev) => [
    ...prev,
    { id: entryId(), role: 'user', content: topic.label, proposals: [], local: true },
    { id: entryId(), role: 'assistant', content: topic.text, proposals: [], local: true }]
    );
  }, [pending]);

  const showNext = useCallback(async () => {
    if (pending) return;
    // 묻는 말을 먼저 붙이고, 진행 상황을 읽는 동안은 다른 말을 받지 않는다
    setEntries((prev) => [...prev, { id: entryId(), role: 'user', content: '다음에 할 일', proposals: [], local: true }]);
    const answer = (entry: Omit<ChatEntry, 'id' | 'role' | 'local'>) =>
    setEntries((prev) => [...prev, { id: entryId(), role: 'assistant', local: true, ...entry }]);
    if (!batchId) {
      answer({
        content: '카드내역을 먼저 올려 주세요. 올리면 분류 확인부터 차례로 안내합니다.',
        proposals: toEntries([{ kind: 'navigation', route: '/upload', card: '카드내역 화면으로 이동' }])
      });
      return;
    }
    setPending(true);
    try {
      const { next } = await api.progress.get(batchId);
      answer(
        next ?
        {
          content: `다음 할 일은 「${next.label}」입니다.`,
          proposals: toEntries([
          { kind: 'navigation', route: next.route, card: `${routeName(next.route) ?? next.label} 화면으로 이동` }]
          )
        } :
        { content: '지금 할 일이 남아 있지 않습니다.', proposals: [] }
      );
    } catch {
      const flow = HELP_TOPICS.find((topic) => topic.id === 'flow');
      answer({ content: `진행 상황을 불러오지 못했습니다. ${flow?.text ?? ''}`, proposals: [] });
    } finally {
      setPending(false);
    }
  }, [pending, batchId]);

  const updateProposal = (id: string, index: number, patch: Partial<ProposalEntry>) =>
  setEntries((prev) =>
  prev.map((entry) =>
  entry.id === id ?
  {
    ...entry,
    proposals: entry.proposals.map((item, i) => i === index ? { ...item, ...patch } : item)
  } :
  entry
  )
  );

  const apply = useCallback(async (id: string, index: number) => {
    const target = entriesRef.current.find((entry) => entry.id === id)?.proposals[index];
    if (!target || target.state === 'busy' || target.state === 'done') return;
    updateProposal(id, index, { state: 'busy', result: undefined });
    try {
      const result = await applyProposal(api, target.proposal, navigate, target.key);
      updateProposal(id, index, { state: 'done', result });
    } catch (caught) {
      updateProposal(id, index, { state: 'failed', result: applyErrorText(caught) });
    }
    // 패널은 화면 밖에 있다. 성공하든 실패하든(그사이 바뀌었을 수 있다) 떠 있는 화면을 다시 읽게 한다
    invalidateAll();
  }, [navigate]);

  const showNudge = useCallback((next: Nudge, once?: string) => {
    if (once) {
      if (nudged.current.has(once)) return;
      nudged.current.add(once);
    }
    setNudge(next);
  }, []);

  const dismissNudge = useCallback(() => setNudge(null), []);

  // 알림이 가리키는 화면에 오면 알림은 할 일을 다 했다. 그 화면이 같은 내용을 지금 값으로 보여 준다
  // (질문 화면의 「지난번 답 한 번에 적용」). 메뉴로 왔거나 거기서 다 적용해도 알림이 남지 않게 한다
  useEffect(() => {
    if (nudge?.route === pathname) setNudge(null);
  }, [nudge, pathname]);

  const value = useMemo<AssistantValue>(
    () => ({
      open,
      setOpen,
      entries,
      pending,
      error,
      draft,
      setDraft,
      send,
      showHelp,
      showNext,
      apply,
      setSubject,
      nudge,
      showNudge,
      dismissNudge
    }),
    [open, entries, pending, error, draft, send, showHelp, showNext, apply, nudge, showNudge, dismissNudge]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
