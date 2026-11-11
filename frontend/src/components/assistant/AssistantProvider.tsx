import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, ApiRequestError, invalidateAll } from '../../api';
import type { AssistantChatResponse, AssistantProposal } from '../../types/domain';
import { useSession } from '../../contexts/SessionContext';
import { AssistantContext } from './context';
import type { Attached, AssistantValue, ChatEntry, Nudge, ProposalEntry } from './context';
import { ASK_DRAFT, askBus } from './ask';
import { answerLabel } from '../questions/logic';
import { ro } from '../../utils/format';
import { HELP_TOPICS } from './help';
import { applyErrorText, applyProposal, chatErrorText, historyOf, MESSAGE_CHARS, nextAnswer, routeName } from './logic';

const entryId = () => crypto.randomUUID();

/** 귀속연도. 서비스는 2026 귀속만 다룬다(머리글의 「귀속 2026년」). 비서의 연간 요약이 이 값으로 범위를 잡는다 */
const TAX_YEAR = 2026;

/** 다음 답 칩을 찾을 때 읽는 남은 질문 수. 거래 하나의 질문은 몇 개뿐이다 */
const NEXT_QUESTIONS = 10;

/**
 * 비서 Really 의 대화 상태. 라우트 바깥에 한 번만 올려 두어, 화면을 옮기거나 랜딩에 다녀와도 대화가 이어진다(FR-1).
 * 계정이 바뀌면 다시 올라가 대화가 사라진다(App 의 key). 서버는 대화를 저장하지 않는다(C-12)
 */
export function AssistantProvider({ children }: {children: React.ReactNode;}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { batchId, batchStatus, setBatchId, reloadBatch } = useSession();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  /** [적용]한 뒤 잠깐 띄우는 알림. 패널을 접어도 무엇이 바뀌었는지 보인다 */
  const [toast, setToast] = useState<string | null>(null);
  const [attached, setAttached] = useState<Attached | null>(null);
  const sessionId = useRef(crypto.randomUUID());
  const nudged = useRef(new Set<string>());
  // 보낼 때의 대화. 상태를 읽으려고 send 를 매번 새로 만들지 않는다
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const toEntries = (proposals: AssistantProposal[]): ProposalEntry[] =>
  proposals.map((proposal) => ({ proposal, key: crypto.randomUUID(), state: 'idle' }));

  /**
   * 다음 답 칩. 보고 있는 거래에 남은 질문이 있으면 그 선택지를 답 아래에 칩으로 둔다.
   * 이번 답에 답 카드가 있으면 그 질문의 다른 선택지만 둔다. 칩 글은 선택지 이름이고, 무엇이 바뀌는지는 말하지 않는다.
   * 못 읽으면 칩 없이 둔다
   */
  const findNext = useCallback(async (id: string, transactionId: string, reply: AssistantChatResponse) => {
    const cards = reply.proposals.filter((proposal) => proposal.kind === 'answer');
    try {
      const page = await api.questions.list({ transactionId, status: 'PENDING', size: NEXT_QUESTIONS });
      const wanted = cards.length > 0 ? new Set(cards.flatMap((card) => card.questionIds)) : null;
      const question = page.items.find((item) => !wanted || wanted.has(item.id));
      if (!question) return;
      const proposed = new Set(cards.filter((card) => card.questionIds.includes(question.id)).map((card) => card.value));
      const options = question.options.filter((option) => !proposed.has(option));
      if (options.length === 0) return;
      setEntries((prev) =>
      prev.map((entry) =>
      entry.id === id ? { ...entry, next: { questionId: question.id, questionText: question.questionText, options } } : entry
      )
      );
    } catch {
      // 칩은 덤이다. 못 읽어도 답은 그대로 있다
    }
  }, []);

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
      const id = entryId();
      setEntries((prev) => [
      ...prev,
      { id, role: 'assistant', content: reply.answer, proposals: toEntries(reply.proposals) }]
      );
      if (subject) void findNext(id, subject, reply);
    } catch (caught) {
      // 못 보낸 말은 대화에서 빼고 입력칸으로 돌려준다. 고쳐서 다시 보낼 수 있게
      setEntries((prev) => prev.filter((entry) => entry.id !== mine.id));
      setDraft(message);
      setError(chatErrorText(caught));
      // 세션이 가리키는 업로드·거래가 지워졌으면 매번 404 다. 빼고 남은 업로드에서 다시 고른다
      if (caught instanceof ApiRequestError && caught.code === 'BATCH_NOT_FOUND') {
        setBatchId(null);
        reloadBatch();
      }
      if (caught instanceof ApiRequestError && caught.code === 'TRANSACTION_NOT_FOUND') setSubject(null);
    } finally {
      setPending(false);
    }
  }, [pending, pathname, batchId, subject, setBatchId, reloadBatch, findNext]);

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
    const answer = (content: string, route: string | null = null) =>
    setEntries((prev) => [
    ...prev,
    {
      id: entryId(),
      role: 'assistant',
      local: true,
      content,
      // 지금 있는 화면으로 가는 카드는 붙이지 않는다 (C106)
      proposals:
      route && route !== pathname ?
      toEntries([{ kind: 'navigation', route, card: `${routeName(route) ?? '다음'} 화면으로 이동` }]) :
      []
    }]
    );
    // 업로드 목록을 고르는 중이면 batchId 가 아직 없다. 올린 게 없다는 말은 다 읽은 뒤에만 한다 (C56)
    if (batchStatus === 'loading') {
      answer('올린 카드내역을 불러오는 중입니다. 잠시 뒤 다시 눌러 주세요.');
      return;
    }
    if (batchStatus === 'error') {
      reloadBatch();
      answer('올린 카드내역을 불러오지 못했습니다. 다시 불러오고 있으니 잠시 뒤 다시 눌러 주세요.');
      return;
    }
    if (!batchId) {
      answer('카드내역을 먼저 올려 주세요.', '/upload');
      return;
    }
    setPending(true);
    try {
      const { next } = await api.progress.get(batchId);
      const { content, route } = nextAnswer(next, pathname);
      answer(content, route);
    } catch (caught) {
      const flow = HELP_TOPICS.find((topic) => topic.id === 'flow');
      if (caught instanceof ApiRequestError && caught.code === 'BATCH_NOT_FOUND') {
        setBatchId(null);
        reloadBatch();
        answer('보던 업로드를 찾을 수 없습니다. 업로드 이력에서 볼 업로드를 골라 주세요.', '/uploads');
        return;
      }
      answer(`진행 상황을 불러오지 못했습니다. ${flow?.text ?? ''}`);
    } finally {
      setPending(false);
    }
  }, [pending, batchId, batchStatus, setBatchId, reloadBatch, pathname]);

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
      setToast(result);
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

  /** 칩을 누르면 그 답의 카드를 그 답 아래에 연다. 저장은 사용자가 [적용]을 누를 때 기존 API 로 한다 */
  const pickNext = useCallback((id: string, value: string) => {
    setEntries((prev) =>
    prev.map((entry) => {
      if (entry.id !== id || !entry.next) return entry;
      const { questionId, questionText } = entry.next;
      const card: AssistantProposal = {
        kind: 'answer',
        questionIds: [questionId],
        value,
        source: 'ASSISTANT',
        card: `${questionText} ${answerLabel(value)}${ro(answerLabel(value))} 답합니다.`
      };
      // 같은 칩을 두 번 눌러도 카드는 하나다
      const exists = entry.proposals.some(
        (item) => item.proposal.kind === 'answer' && item.proposal.questionIds[0] === questionId && item.proposal.value === value
      );
      return exists ? entry : { ...entry, proposals: [...entry.proposals, { proposal: card, key: crypto.randomUUID(), state: 'idle' }] };
    })
    );
  }, []);

  const detach = useCallback(() => {
    setAttached(null);
    setSubject(null);
  }, []);

  // 화면이 Really 를 부른다(Really 버튼을 끌어 놓기, 행의 묻기 버튼). 패널을 열고 무엇을 묻는지 붙인다
  useEffect(
    () =>
    askBus.subscribe((target) => {
      setOpen(true);
      setError(null);
      if (target.kind === 'transaction') {
        setSubject(target.transactionId);
        setAttached({ transactionId: target.transactionId, label: target.label });
        return;
      }
      // 근거 조문과 판정 이유는 그 거래를 붙이고 물을 말을 미리 적는다
      if ((target.kind === 'statute' || target.kind === 'reason') && target.transactionId) {
        setSubject(target.transactionId);
        setAttached({ transactionId: target.transactionId, label: target.label });
      }
      // 금액 판과 한도는 업로드 전체를 묻는다. 앞서 붙이거나 고른 거래를 떼지 않으면 Really 가 그 거래로 답한다(11/11).
      // 표에서 행을 다시 고르면 그 거래가 다시 붙는다
      if (target.kind === 'summary' || target.kind === 'limit') {
        setSubject(null);
        setAttached(null);
      }
      setDraft(ASK_DRAFT[target.kind]);
    }),
    []
  );

  // 다른 거래를 보게 되면 붙인 이름은 맞지 않는다
  useEffect(() => {
    if (attached && attached.transactionId !== subject) setAttached(null);
  }, [attached, subject]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
      dismissNudge,
      toast,
      attached,
      detach,
      pickNext
    }),
    [open, entries, pending, error, draft, send, showHelp, showNext, apply, nudge, showNudge, dismissNudge, toast, attached, detach, pickNext]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
