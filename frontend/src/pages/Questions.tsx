import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightIcon, CheckIcon, LayersIcon, PencilIcon, SearchXIcon, XIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { StepEyebrow } from '../components/StepEyebrow';
import { VerdictBadge } from '../components/VerdictBadge';
import { Badge, Button, ChoiceGroup, Empty, IconButton, Pagination } from '../components/ui';
import { useSession } from '../contexts/SessionContext';
import { api, ApiRequestError, useApi } from '../api';
import { previousAnswer } from '../components/assistant/logic';
import { merchantTitle } from '../components/results/display';
import { answerLabel, respondOnce, UNCONFIRMED_CODE, verdictsAfter, withHeld } from '../components/questions/logic';
import type { VerdictTally } from '../components/questions/logic';
import type { AnswerSource, QuestionGroup } from '../types/domain';
import { formatFullDate, formatNumber, formatWon, ro } from '../utils/format';
import { ShortcutHelp, type Shortcut } from '../components/ShortcutHelp';
import { REF_ATTR } from '../components/assistant/ask';

/** ? 를 누르면 뜨는 목록. 선택지에 초점이 있을 때 듣는다 */
const SHORTCUTS: Shortcut[] = [
{ keys: ['1', '2', '3'], label: '몇 번째 선택지로 답하기' },
{ keys: ['←', '→'], label: '선택지 사이 옮기기' },
{ keys: ['?'], label: '단축키 보기' }];


/** Really 제안 카드에 마우스를 올리면 바뀔 질문에 테두리를 두른다(제안이 가리키는 질문과 거래) */
const groupRef = (group: QuestionGroup) =>
[...group.questionIds.map((id) => `q:${id}`), ...new Set(group.transactions.map((row) => `tx:${row.transactionId}`))].join(' ');

/** F1-a. 한 번에 보여주는 질문 수(잠정). 다 답하면 다음 질문이 이어서 나온다 */
const BATCH_SIZE = 15;
/** 답한 질문 목록 한 쪽의 그룹 수. 전에는 100개만 받아 그 뒤의 답은 고칠 수 없었다 */
const ANSWERED_SIZE = 20;
/** F1-c. 남은 질문이 이만큼 이하일 때만 일괄 답변을 연다. 첫 화면부터 전부 닫아버리지 않게 */
const BULK_THRESHOLD = 5;
/** 카드마다 보여주는 거래 수. 넘으면 「외 N건」 */
const SHOWN_TRANSACTIONS = 3;
/**
 * 한 번에 답한 뒤 목록을 다 받고 나서도 선택지를 막아 두는 시간. 답한 카드가 빠지는 움직임(0.18초)보다
 * 넉넉히 둔다. 그 사이 같은 자리를 또 누르면 올라온 다음 카드의 답이 된다 (C68)
 */
const SETTLE_MS = 600;
/** 카드나 일괄 답변 칸이 아니라 화면 위쪽에 띄우는 오류(지난번 답 적용)의 자리 */
const TOP = 'top';
/** 처음 읽는 동안 값 대신 두는 자리 */
const PLACEHOLDER = 'block animate-pulse rounded bg-line2 motion-reduce:animate-none';

const errorMessage = (caught: unknown, fallback: string) =>
caught instanceof ApiRequestError ? caught.message : fallback;

/** 그룹 응답과 어긋난 질문을 보낸 경우다. 목록을 다시 읽으면 맞는 묶음으로 돌아온다 (3.10) */
const MIXED_BATCHES = '다른 업로드의 질문이 섞여 함께 답할 수 없습니다. 목록을 다시 불러왔습니다.';

const groupId = (group: QuestionGroup) => `${group.groupKey}|${group.factType}`;

/** 같은 factType 질문들이 모두 허용하는 선택지. 일괄 답변은 이 값만 보낼 수 있다 (3.11) */
const commonOptions = (groups: QuestionGroup[]) =>
groups[0].options.filter((option) => groups.every((group) => group.options.includes(option)));

/** 선택지는 룰카드 값을 보내고 화면 이름으로 보여 준다 */
const choicesOf = (group: QuestionGroup) => group.options.map((option) => ({ value: option, label: answerLabel(option) }));

/** 한 번에 답하기의 「…으로 답했습니다」 앞에 붙는 답. 조사까지 화면 이름에 맞춘다 */
const answeredAs = (value: string) => {
  const label = answerLabel(value);
  return `${label}${ro(label)}`;
};

/** 한 번에 답할 질문 묶음의 이름. 내부 fact_type 대신 가맹점을 적는다 (C104) */
const merchantsOf = (groups: QuestionGroup[]) =>
[...new Set(groups.flatMap((group) => group.transactions.slice(0, 1).map(merchantTitle)))].join(', ');

/** 답한 뒤 카드 안에 남기는 결과. tally 는 다시 판정한 결과이고 못 읽었으면 null 이다 (C28) */
interface Outcome {
  /** null 이면 고른 답을 다시 눌러 거뒀다 */
  value: string | null;
  tally: VerdictTally[] | null;
  /** 다른 질문의 답이 같은 거래의 판정을 바꾸면 이 그룹의 결과를 다시 읽는다 */
  group: QuestionGroup;
}

/**
 * 3.9~3.11 룰엔진 확인 질문.
 * 질문을 자르지 않고 묶어서 나눠 보여준다(F1-a). 미해소 건수·금액은 항상 보이고(F1-b),
 * 남은 꼬리는 한 번에 닫을 수 있다(F1-c). 답한 질문도 다시 바꿀 수 있다(3.10 답변 정정).
 */
export function Questions() {
  const { batchId, batchStatus, reloadBatch } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  /** 한 번에 답한 뒤 목록이 다시 그려지는 동안 선택지를 막는다 (C68) */
  const [settling, setSettling] = useState(false);
  /** 지난번 답 적용, 한 번에 답하기의 결과 */
  const [notice, setNotice] = useState<string | null>(null);
  /** at 은 실패한 자리다. 카드면 groupId, 한 번에 답하기면 bulk|factType, 그 밖에는 TOP */
  const [error, setError] = useState<{at: string;message: string;} | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  /** 이 페이지에서 답한 카드. 목록을 다시 읽어도 원래 자리에 남긴다 (C68) */
  const [held, setHeld] = useState<{index: number;item: QuestionGroup;}[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [bulkChoice, setBulkChoice] = useState<Record<string, string>>({});
  /** 「지난번 답 한 번에 적용」에서 뺀 그룹 */
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  /** 건너뛴 질문이 앞자리를 막아도 뒤 질문에 닿을 수 있게 페이지를 넘긴다 */
  const [page, setPage] = useState(0);
  const [answeredPage, setAnsweredPage] = useState(0);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  const pendingQ = useApi(
    () =>
    batchId ?
    api.questions.grouped({ batchId, status: 'PENDING', page, size: BATCH_SIZE }) :
    Promise.resolve(null),
    [batchId, page]
  );
  const answeredQ = useApi(
    () =>
    batchId ?
    api.questions.grouped({ batchId, status: 'ANSWERED', page: answeredPage, size: ANSWERED_SIZE }) :
    Promise.resolve(null),
    [batchId, answeredPage]
  );
  // 지난번 답 (FR-5, agent-secretary.md 3.1). 못 읽으면 지난번 답 없이 그대로 그린다
  const suggestionsQ = useApi(
    () => batchId ? api.questions.suggestions(batchId).catch(() => null) : Promise.resolve(null),
    [batchId]
  );
  const errorRef = useRef<HTMLParagraphElement>(null);
  /** 카드와 한 번에 답하기 칸의 결과·오류 문구. 키는 error.at 과 같다 */
  const statusRefs = useRef(new Map<string, HTMLElement>());
  /** 지금 보이는 페이지. 다음 페이지를 받는 동안에는 이전 페이지 번호로 센다 */
  const shownPage = pendingQ.data?.page.number ?? 0;

  const pending = pendingQ.data?.items ?? [];
  const pendingTotal = pendingQ.data?.page.totalElements ?? 0;
  const answered = answeredQ.data?.items ?? [];
  const answeredTotal = answeredQ.data?.page.totalElements ?? 0;
  const unresolved = pendingQ.data?.unresolved;
  /** 처음 읽는 중. 다시 읽을 때는 이전 목록을 그대로 둔다 */
  const loading = !pendingQ.data;
  const heldKeys = new Set(held.map(({ item }) => groupId(item)));
  /** 아직 답하지 않은 카드. 서버가 다시 주기 전에도 방금 답한 카드는 뺀다 */
  const unanswered = pending.filter((group) => !heldKeys.has(groupId(group)));
  /**
   * 서버가 가진 지금의 그룹. 답을 거두면 서버가 같은 질문을 새 id 로 다시 내고 옛 id 는 취소한다.
   * 제자리에 남긴 카드는 자리만 기억하고, 그리는 그룹(id, 서버가 저장한 답)은 늘 다시 읽은 목록의 것을 쓴다.
   * 한 번에 답하기가 거둔 카드에 답을 넣어도 그 답이 보인다
   */
  const latest = (group: QuestionGroup) => {
    const key = groupId(group);
    return pending.find((item) => groupId(item) === key) ?? answered.find((item) => groupId(item) === key) ?? group;
  };
  const shown = withHeld(unanswered, held.map((entry) => ({ ...entry, item: latest(entry.item) })));
  /** 제자리에 남긴 카드는 답한 질문 목록에 또 그리지 않는다 */
  const answeredRows = answered.filter((group) => !heldKeys.has(groupId(group)));

  // 답한 질문 목록의 마지막 쪽이 비면(정정으로 그룹이 합쳐지는 등) 첫 쪽으로 돌아간다
  const answeredEmpty = Boolean(answeredQ.data) && answered.length === 0;
  useEffect(() => {
    if (answeredPage > 0 && answeredEmpty) setAnsweredPage(0);
  }, [answeredPage, answeredEmpty]);

  // 마지막 질문에 답해 그 페이지가 비면 첫 페이지로 돌아간다
  useEffect(() => {
    if (page > 0 && pendingQ.data && shown.length === 0) setPage(0);
  }, [page, pendingQ.data, shown.length]);

  // 다른 업로드로 바꾸면 남겨 둔 카드도 버린다
  useEffect(() => {
    setHeld([]);
  }, [batchId]);

  useEffect(() => {
    if (!settling || pendingQ.loading) return;
    const timer = window.setTimeout(() => setSettling(false), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [settling, pendingQ.loading]);

  const locked = busy !== null || settling;

  const reload = () => {
    pendingQ.reload();
    answeredQ.reload();
  };

  const statusRef = (at: string) => (element: HTMLElement | null) => {
    if (element) statusRefs.current.set(at, element);else
    statusRefs.current.delete(at);
  };

  /** 저장하는 동안 선택지가 막혀 초점이 사라진다. 결과나 오류 문구로 옮겨 읽어 준다 */
  const focusLater = (at: string) =>
  window.setTimeout(() => (at === TOP ? errorRef.current : statusRefs.current.get(at))?.focus(), 0);

  const announce = (message: string) => {
    setNotice(message);
    window.setTimeout(() => noticeRef.current?.focus(), 0);
  };

  const fail = (at: string, message: string) => {
    setError({ at, message });
    focusLater(at);
  };

  /**
   * 지금 고른 답. 방금 답한 것은 목록을 다시 받기 전에도 반영한다.
   * 거둔 것(null)은 서버 값을 따른다. 다시 받은 그룹은 답이 없고, 그 뒤 한 번에 답하기로 답했으면 그 답이다
   */
  const answerOf = (group: QuestionGroup) => outcomes[groupId(group)]?.value ?? group.answer?.value;

  /**
   * 거둔 뒤 목록을 다시 받으면 할 일. 서버는 거둔 질문을 새 id 로 다시 낸다. 다른 페이지로 갔으면 제자리에 남긴 카드를 빼고,
   * 카드의 결과 줄이나 알림으로 초점을 옮긴다. data 는 다시 읽기 직전의 목록이다. 그것과 다르고 둘 다 다 읽었을 때 움직인다
   */
  const afterWithdraw = useRef<{key: string;data: unknown;} | null>(null);
  const pendingData = useRef(pendingQ.data);
  pendingData.current = pendingQ.data;
  useEffect(() => {
    const waiting = afterWithdraw.current;
    if (!waiting || pendingQ.loading || answeredQ.loading) return;
    // 다시 읽지 못했으면 기다리던 일을 버린다. 남겨 두면 나중에 다른 카드를 답할 때 초점을 빼앗는다
    if (pendingQ.error) {
      afterWithdraw.current = null;
      return;
    }
    if (!pendingQ.data || pendingQ.data === waiting.data) return;
    afterWithdraw.current = null;
    const here = [...pendingQ.data.items, ...(answeredQ.data?.items ?? [])].some((item) => groupId(item) === waiting.key);
    if (!here) setHeld((prev) => prev.filter(({ item }) => groupId(item) !== waiting.key));
    window.setTimeout(() => (statusRefs.current.get(waiting.key) ?? noticeRef.current)?.focus(), 0);
  }, [pendingQ.data, pendingQ.loading, pendingQ.error, answeredQ.data, answeredQ.loading]);

  // 페이지를 옮기면 거둔 카드를 기다리지 않는다
  useEffect(() => {
    afterWithdraw.current = null;
  }, [page]);

  /** 답을 저장했거나 거둔 뒤. 다시 판정한 결과를 읽어 카드에 남긴다. index 는 남은 질문 목록에서의 자리다 */
  const settle = async (group: QuestionGroup, value: string | null, index?: number) => {
    const key = groupId(group);
    // 같은 거래에 걸린 다른 질문(비품의 용도와 자산 등재 등)의 결과도 지금 판정으로 다시 읽는다
    const ids = new Set(group.transactions.map((row) => row.transactionId));
    const related = Object.entries(outcomes).filter(
      ([other, outcome]) => other !== key && outcome.group.transactions.some((row) => ids.has(row.transactionId))
    );
    const [tally, ...refreshed] = await Promise.all([
    verdictsAfter(api, group),
    ...related.map(([, outcome]) => verdictsAfter(api, outcome.group))]
    );
    setOutcomes((prev) => ({
      ...prev,
      ...Object.fromEntries(related.map(([other], at) => [other, { ...prev[other], tally: refreshed[at] }])),
      [key]: { value, tally, group }
    }));
    if (index !== undefined)
    setHeld((prev) =>
    prev.some(({ item }) => groupId(item) === key) ?
    prev :
    [...prev, { index, item: group }].sort((a, b) => a.index - b.index)
    );
    setBusy(null);
    reload();
    focusLater(key);
  };

  /** index 는 남은 질문 목록에서의 자리다. 답한 뒤 그 자리에 카드를 남긴다 */
  const answer = async (group: QuestionGroup, value: string, { source, index }: {source?: AnswerSource;index?: number;} = {}) => {
    const key = groupId(group);
    // 이미 고른 답을 다시 누르면 보내지 않는다. 같은 판정 이력만 늘어난다
    if (locked || answerOf(group) === value) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await respondOnce(api, latest(group), value, source);
    } catch (caught) {
      setBusy(null);
      const code = caught instanceof ApiRequestError ? caught.code : null;
      // 거둔 뒤 다시 읽기 전에 옛 id 로 답하면 409 다. 목록을 다시 읽으면 새 id 로 답할 수 있다
      if (code === 'QUESTIONS_FROM_DIFFERENT_BATCHES' || code === UNCONFIRMED_CODE || code === 'QUESTION_NOT_ANSWERABLE') reload();
      fail(
        key,
        code === 'QUESTIONS_FROM_DIFFERENT_BATCHES' ?
        MIXED_BATCHES :
        errorMessage(caught, '답을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      );
      return;
    }
    await settle(group, value, index);
  };

  /** 고른 답을 다시 누르면 거둔다. 질문은 새 id 로 다시 대기가 되고 그 거래는 확인 필요로 돌아간다 */
  const withdraw = async (group: QuestionGroup, index?: number) => {
    const key = groupId(group);
    if (locked || answerOf(group) === undefined) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await api.questions.withdraw({ questionIds: latest(group).questionIds });
    } catch (caught) {
      setBusy(null);
      const code = caught instanceof ApiRequestError ? caught.code : null;
      if (code === 'QUESTION_NOT_ANSWERABLE' || code === 'QUESTION_NOT_FOUND') reload();
      fail(key, errorMessage(caught, '답을 지우지 못했습니다. 잠시 후 다시 시도해 주세요.'));
      return;
    }
    const tally = await verdictsAfter(api, group);
    setOutcomes((prev) => ({ ...prev, [key]: { value: null, tally, group } }));
    // 답한 질문 목록에서 거뒀으면 그 줄은 사라지고 남은 질문 쪽에 다시 나온다. 어디로 갔는지 알린다
    if (index === undefined) {
      setEditing(null);
      setNotice('답을 지웠습니다. 남은 질문에서 다시 답할 수 있습니다.');
    }
    // 새 id 를 받기 전에 다시 누르면 취소된 옛 id 로 보낸다. 목록을 다시 받을 때까지 막는다
    // 기다리는 동안 앞서 보낸 다시 읽기가 끝났을 수 있다. 화면이 그린 값이 아니라 지금 가진 목록과 비교한다
    afterWithdraw.current = { key, data: pendingData.current };
    setSettling(true);
    setBusy(null);
    reload();
  };

  /** 한 번에 답하면 거둔 카드에도 답이 들어간다. 「답을 지웠습니다」를 걷는다 */
  const dropWithdrawn = () =>
  setOutcomes((prev) => Object.fromEntries(Object.entries(prev).filter(([, outcome]) => outcome.value !== null)));

  const answerAll = async (factType: string, value: string | undefined) => {
    if (!batchId || !value || locked) return;
    const at = `bulk|${factType}`;
    setBusy(at);
    setError(null);
    setNotice(null);
    try {
      const result = await api.questions.bulkAnswer({ batchId, factType, answer: { value } });
      // 건너뛴 것은 종류가 다른 질문(skipped)과 같은 종류의 소명 대기(excluded)다 (3.11)
      const left = result.skippedCount + result.excludedCount;
      announce(
        `질문 ${formatNumber(result.answeredCount)}개에 ${answeredAs(value)} 답했습니다.${
        left > 0 ? ` 나머지 질문 ${formatNumber(left)}개는 그대로 남았습니다.` : ''}`
      );
      dropWithdrawn();
      setSettling(true);
      reload();
    } catch (caught) {
      fail(at, errorMessage(caught, '한 번에 답하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(null);
    }
  };

  const previousOf = (group: QuestionGroup) =>
  previousAnswer(
    group,
    suggestionsQ.data?.items.find((item) => item.groupKey === group.groupKey && item.factType === group.factType)
  );
  /** 답이 없는 카드. 제자리에 남긴 카드 중 답을 거둔 것도 든다 */
  const waiting = shown.filter((group) => answerOf(group) === undefined);
  /** 이 페이지에서 지난번 답으로 바로 채울 수 있는 그룹 (A 이어받기) */
  const carryOver = waiting.flatMap((group) => {
    const previous = previousOf(group);
    return previous?.kind === 'apply' ? [{ group, value: previous.value, text: previous.text }] : [];
  });
  const carryChosen = carryOver.filter(({ group }) => !skipped[groupId(group)]);

  // 확인 목록에서 고른 것만 기존 응답 API 로 하나씩 보낸다. 한 번에 닫는 API 가 따로 없다 (3.1)
  const applyCarryOver = async () => {
    if (locked || carryChosen.length === 0) return;
    setBusy('carry');
    setError(null);
    setNotice(null);
    let saved = 0;
    for (const { group, value } of carryChosen) {
      try {
        // 하나씩 답할 때와 같이, 응답을 잃으면 저장됐는지 먼저 본다 (C49)
        await respondOnce(api, group, value, 'PREVIOUS_ANSWER');
        saved += 1;
      } catch {
        // 남은 것도 보낸다. 몇 개를 못 했는지 알린다
      }
    }
    setBusy(null);
    const missed = carryChosen.length - saved;
    if (missed > 0) fail(TOP, `지난번 답 ${formatNumber(missed)}개는 저장하지 못했습니다. 그 질문은 그대로 남아 있습니다.`);
    if (saved > 0) announce(`지난번 답으로 질문 ${formatNumber(saved)}개에 답했습니다.`);
    if (saved > 0) dropWithdrawn();
    // 이 칸이 사라지면 아래 카드가 포인터 밑으로 올라온다
    setSettling(true);
    reload();
  };

  // 남은 질문이 적을 때만 factType 별로 묶어 일괄 답변을 연다
  const bulkCandidates =
  pendingTotal > 0 && pendingTotal <= BULK_THRESHOLD ?
  [...new Set(waiting.map((group) => group.factType))].
  map((factType) => {
    const groups = waiting.filter((group) => group.factType === factType);
    return { factType, groups, options: commonOptions(groups) };
  }).
  filter((target) => target.groups.length > 1 && target.options.length > 0) :
  [];
  // 소명 대기(불가인데 질문이 남음)가 섞인 종류는 한 번에 답하지 않는다. 같은 fact_type 으로 묶여
  // 「전부 업무미팅」 한 번에 주말 불가 추정이 모두 풀린다 (rule-card-fields.md).
  // 서버가 그룹마다 bulkAnswerable 로 알려 준다 (3.9)
  // 빠진 종류는 카드에서 하나씩 답한다. 왜 빠졌는지는 적지 않는다
  const bulkTargets = bulkCandidates.filter((target) => target.groups.every((group) => group.bulkAnswerable));

  /** 선택지 바로 아래 한 줄. 위가 아니라 아래에 붙여야 누른 자리 밑의 선택지가 움직이지 않는다 */
  const statusLine = (key: string) => {
    if (busy === key) return <p className="mt-3 text-small text-ink2">저장하는 중</p>;
    if (error?.at === key)
    return (
      <p ref={statusRef(key)} role="alert" tabIndex={-1} className="mt-3 text-small text-deny outline-none">
          {error.message}
        </p>);

    const outcome = outcomes[key];
    if (!outcome) return null;
    return (
      <p
        ref={statusRef(key)}
        tabIndex={-1}
        className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-small text-ink2 outline-none">

        <span>
          {outcome.value === null ?
          '답을 지웠습니다' :
          <>답 <strong className="font-bold text-ink">{answerLabel(outcome.value)}</strong></>}
        </span>
        {outcome.tally?.map(({ verdict, count, amount }) =>
        <span key={verdict.code} className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
            <VerdictBadge verdict={verdict} />
            {count > 1 && <span>{formatNumber(count)}건</span>}
            {amount !== null &&
          <span>
                경비 가능 <strong className="font-bold text-ink">{formatWon(amount)}</strong>
              </span>
          }
          </span>
        )}
      </p>);

  };

  const header =
  <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <StepEyebrow />
        {/* 판정 이름(확인 필요)을 제목에 다시 쓰지 않는다. 화면 이름 그대로다 (C12) */}
        <h1 className="mt-1.5 text-h2 font-bold tracking-tight text-ink">질문</h1>
      </div>
      <Button to="/results" variant="secondary" size="sm" className="whitespace-nowrap">
        결과 보기
        <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
      </Button>
    </header>;


  // 업로드 목록을 고르는 동안은 아래 자리 표시로 기다린다. 올린 게 없다는 것은 다 읽은 뒤에만 말한다 (C56)
  if (batchStatus === 'error') {
    return (
      <AppShell narrow>
        <div className="max-w-3xl">
          {header}
          <Empty
            className="mt-6"
            tone="error"
            icon={<SearchXIcon className="h-5 w-5" />}
            title="올린 카드내역을 불러오지 못했습니다"
            action={
            <Button size="sm" variant="secondary" onClick={reloadBatch}>
                다시 시도
              </Button>
            } />
        </div>
      </AppShell>);

  }

  if ((batchStatus === 'ready' && !batchId) || pendingQ.error) {
    return (
      <AppShell narrow>
        <div className="max-w-3xl">
          {header}
          {!batchId ?
          <Empty
            className="mt-6"
            icon={<SearchXIcon className="h-5 w-5" />}
            title="올린 카드내역이 없습니다"
            action={
            <Button to="/upload" size="sm" variant="secondary">
                  카드내역 올리기
                </Button>
            } /> :


          <Empty
            className="mt-6"
            tone="error"
            icon={<SearchXIcon className="h-5 w-5" />}
            title="질문을 불러오지 못했습니다"
            action={
            <Button size="sm" variant="secondary" onClick={reload}>
                  다시 시도
                </Button>
            } />

          }
        </div>
      </AppShell>);

  }

  return (
    <AppShell narrow>
      <div className="max-w-3xl">
        {header}

        {/* 읽기 전에는 숫자 대신 자리만 둔다. 「—」나 0 을 보이면 실제 값처럼 읽힌다 (C66) */}
        <p className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-1 text-body tabular-nums text-ink2">
          <span className="flex items-center gap-2">
            남은 질문
            {loading ?
            <span className={`h-4 w-10 ${PLACEHOLDER}`} /> :
            <strong className="font-bold text-ink">{formatNumber(pendingTotal)}개</strong>
            }
          </span>
          {(loading || unresolved) &&
          <span className="flex items-center gap-2">
              질문이 걸린 금액
              {unresolved ?
            <strong className="font-bold text-ink">{formatWon(unresolved.amount)}</strong> :
            <span className={`h-4 w-24 ${PLACEHOLDER}`} />
            }
            </span>
          }
        </p>

        {/* 결과를 읽어 주는 자리. 비어 있어도 DOM 에 남아 있어야 바뀐 내용을 읽는다 */}
        <p
          ref={noticeRef}
          role="status"
          tabIndex={-1}
          className={notice ? 'mt-4 text-body text-ink2 outline-none' : 'sr-only'}>

          {notice}
        </p>
        {error?.at === TOP &&
        <p ref={errorRef} role="alert" tabIndex={-1} className="mt-4 text-body text-deny outline-none">
            {error.message}
          </p>
        }

        {carryOver.length >= 2 &&
        <section className="mt-6 rounded-2xl border border-line p-5">
            <h2 className="text-body font-bold text-ink">지난번 답 한 번에 적용</h2>
            <ul className="mt-3 space-y-3">
              {carryOver.map(({ group, text }) => {
              const key = groupId(group);
              return (
                <li key={key}>
                    <label htmlFor={`carry-${key}`} className="flex items-start gap-2.5 text-small text-ink2">
                      <input
                      id={`carry-${key}`}
                      type="checkbox"
                      className="mt-1"
                      checked={!skipped[key]}
                      disabled={locked}
                      onChange={(event) => setSkipped((prev) => ({ ...prev, [key]: !event.target.checked }))} />

                      <span>
                        <span className="text-ink">
                          <strong className="font-bold">{group.transactions[0] && merchantTitle(group.transactions[0])}</strong>{' '}
                          {group.questionText}
                        </span>
                        <span className="block">{text}</span>
                      </span>
                    </label>
                  </li>);

            })}
            </ul>
            <div className="mt-4 flex justify-end">
              <Button
              variant="secondary"
              size="sm"
              className="whitespace-nowrap"
              disabled={locked || carryChosen.length === 0}
              onClick={() => void applyCarryOver()}>

                {busy === 'carry' ? '적용하는 중' : `${formatNumber(carryChosen.length)}개 적용`}
              </Button>
            </div>
          </section>
        }

        {loading ?
        <ol aria-hidden="true" className="mt-6 space-y-3">
            {[0, 1, 2].map((slot) =>
          <li key={slot} className="rounded-2xl border border-line px-5 py-5">
                <span className={`h-4 w-1/4 ${PLACEHOLDER}`} />
                <span className={`mt-3 h-5 w-2/3 ${PLACEHOLDER}`} />
                <span className={`mt-5 h-12 w-full ${PLACEHOLDER}`} />
              </li>
          )}
          </ol> :
        // 뒤 페이지가 비면 첫 페이지로 돌아가므로, 그 사이에 「다 답했다」를 띄우지 않는다
        !pendingQ.loading && shown.length === 0 && shownPage === 0 ?
        <Empty
          className="mt-6"
          icon={<CheckIcon className="h-5 w-5" />}
          title={
          answeredQ.error || !answeredQ.data ?
          '남은 질문이 없습니다' :
          answeredTotal > 0 ?
          '모든 질문에 답했습니다' :
          '물어볼 질문이 없습니다'
          } /> :


        <ol className="mt-6 space-y-3">
            <AnimatePresence initial={false}>
              {shown.map((group, index) => {
              const key = groupId(group);
              const rows = group.transactions;
              const previous = previousOf(group);
              return (
                <motion.li
                  key={key}
                  layout
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}>

                    <section {...{ [REF_ATTR]: groupRef(group) }} className="overflow-hidden rounded-2xl border border-line">
                      <header className="flex items-start gap-3 border-b border-line2 px-5 py-4">
                        <span className="mt-0.5 w-6 shrink-0 text-center text-small font-bold tabular-nums text-muted">
                          {shownPage * BATCH_SIZE + index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {rows[0] &&
                          <Badge className="max-w-full">
                                <span className="min-w-0 truncate">
                                  {merchantTitle(rows[0])}
                                  {new Set(rows.map(merchantTitle)).size > 1 && ' 외'}
                                </span>
                              </Badge>
                          }
                            <span className="flex items-center gap-1.5 whitespace-nowrap text-caption tabular-nums text-ink2">
                              {group.count > 1 &&
                            <>
                                  <LayersIcon className="h-3 w-3" aria-hidden="true" />
                                  <span>{formatNumber(group.count)}건</span>
                                </>
                            }
                              <span>{formatWon(group.totalAmount)}</span>
                            </span>
                          </div>
                          <h2 className="mt-2 text-h4 font-bold text-ink">{group.questionText}</h2>
                          {rows.length > 0 &&
                        <ul className="mt-2 space-y-0.5 text-small tabular-nums text-ink2">
                              {/* 위 이름표와 같은 가맹점, 한 건뿐일 때의 금액은 다시 적지 않는다 */}
                              {rows.slice(0, SHOWN_TRANSACTIONS).map((row) =>
                          <li key={row.questionId} className="flex gap-3">
                                  <span className="shrink-0">{formatFullDate(row.approvedAt)}</span>
                                  <span className="min-w-0 flex-1 truncate">
                                    {merchantTitle(row) === merchantTitle(rows[0]) ? '' : merchantTitle(row)}
                                  </span>
                                  {group.count > 1 && <span className="shrink-0">{formatWon(row.amount)}</span>}
                                </li>
                          )}
                              {group.count > SHOWN_TRANSACTIONS &&
                          <li className="text-muted">외 {formatNumber(group.count - SHOWN_TRANSACTIONS)}건</li>
                          }
                            </ul>
                        }
                          {rows.some((row) => row.overridden) &&
                        <p className="mt-2 text-small text-ink2">직접 바꾼 판정이 있는 거래는 답해도 그 판정이 그대로입니다.</p>
                        }
                        </div>
                      </header>

                      <div className="px-5 py-4">
                        {/* 저장하는 동안은 다른 카드의 선택지도 막는다. 눌러도 아무 일 없는 버튼을 두지 않는다 */}
                        {/* 답한 뒤에도 카드는 그대로 둔다. 지난번 답 줄도 남겨야 그 아래 선택지가 올라오지 않는다 */}
                        <fieldset disabled={locked} className={locked ? 'opacity-60' : ''}>
                          {/* 지난번 답은 사실 그대로 적고, 이어받기(A)만 그 값으로 답할 수 있다. 이력(B)은 미리 고르지 않는다 */}
                          {previous &&
                        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-small text-ink2">
                              <p>{previous.text}</p>
                              {previous.kind === 'apply' &&
                          <Button
                            size="sm"
                            variant="soft"
                            className="whitespace-nowrap"
                            onClick={() => void answer(group, previous.value, { source: 'PREVIOUS_ANSWER', index })}>

                                  이 답으로
                                </Button>
                          }
                            </div>
                        }
                          <ChoiceGroup
                          name={group.questionText}
                          columns={group.options.length >= 3 ? 3 : 2}
                          value={answerOf(group) ?? ''}
                          selectOnFocus={false}
                          numberKeys
                          onChange={(value) => void answer(group, value, { index })}
                          onClear={() => void withdraw(group, index)}
                          options={choicesOf(group)} />

                        </fieldset>
                        {statusLine(key)}
                      </div>
                    </section>
                  </motion.li>);

            })}
            </AnimatePresence>
          </ol>
        }

        {/* 뒤 페이지를 다 답하면 서버는 페이지가 하나라고 하지만, 답한 카드가 남아 있어 앞으로 돌아갈 길이 필요하다 */}
        {pendingQ.data && (pendingQ.data.page.totalPages > 1 || shownPage > 0) &&
        <Pagination
          page={{ ...pendingQ.data.page, totalPages: Math.max(pendingQ.data.page.totalPages, shownPage + 1) }}
          onChange={(next) => {
            setHeld([]);
            setPage(next);
          }}
          note={
          pending.length > 0 ?
          `남은 질문 ${formatNumber(pendingTotal)}개 중 ${formatNumber(
            shownPage * BATCH_SIZE + 1
          )}~${formatNumber(shownPage * BATCH_SIZE + pending.length)}번째` :
          `남은 질문 ${formatNumber(pendingTotal)}개`
          } />

        }

        {bulkTargets.length > 0 &&
        <section className="mt-8 rounded-2xl border border-line p-5">
            <h2 className="text-body font-bold text-ink">남은 질문 한 번에 답하기</h2>
            <div className="mt-4 space-y-6">
              {bulkTargets.map((target) => {
              const merchants = merchantsOf(target.groups);
              // 함께 고를 수 있는 답이 하나뿐이면 고르는 단계 없이 그 답으로 보낸다
              const only = target.options.length === 1 ? target.options[0] : null;
              return (
                <div key={target.factType}>
                    <p className="text-small font-bold text-ink">{merchants}</p>
                    {!only &&
                  <ChoiceGroup
                    className="mt-2"
                    name={`${merchants} 한 번에 답하기`}
                    columns={target.options.length >= 3 ? 3 : 2}
                    value={bulkChoice[target.factType] ?? ''}
                    onChange={(value) => setBulkChoice((prev) => ({ ...prev, [target.factType]: value }))}
                    onClear={() => setBulkChoice((prev) => ({ ...prev, [target.factType]: '' }))}
                    options={target.options.map((option) => ({ value: option, label: `전부 ${answerLabel(option)}` }))} />

                  }
                    <div className="mt-3 flex justify-end">
                      <Button
                      variant="secondary"
                      size="sm"
                      className="whitespace-nowrap"
                      disabled={!only && !bulkChoice[target.factType] || locked}
                      onClick={() => void answerAll(target.factType, only ?? bulkChoice[target.factType])}>

                        {busy === `bulk|${target.factType}` ?
                      '답하는 중' :
                      only ?
                      `${formatNumber(target.groups.length)}개 전부 ${answeredAs(only)} 답하기` :
                      `${formatNumber(target.groups.length)}개 한 번에 답하기`}
                      </Button>
                    </div>
                    {error?.at === `bulk|${target.factType}` &&
                  <p
                    ref={statusRef(error.at)}
                    role="alert"
                    tabIndex={-1}
                    className="mt-2 text-right text-small text-deny outline-none">

                        {error.message}
                      </p>
                  }
                  </div>);

            })}
            </div>
          </section>
        }

        {answeredQ.error &&
        <p role="alert" className="mt-8 text-small text-deny">
            답한 질문을 불러오지 못해 답을 바꿀 수 없습니다.{' '}
            <button type="button" onClick={answeredQ.reload} className="whitespace-nowrap font-bold underline">
              다시 시도
            </button>
          </p>
        }

        {!answeredQ.error && answeredRows.length > 0 &&
        <section className="mt-8">
            <h2 className="text-body font-bold text-ink">답한 질문</h2>
            <ul className="mt-3 divide-y divide-line2 overflow-hidden rounded-2xl border border-line">
              {answeredRows.map((group) => {
              const key = groupId(group);
              const open = editing === key;
              const value = answerOf(group);
              return (
                <li key={key} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-small text-ink">{group.questionText}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-caption tabular-nums text-ink2">
                          <span>{value ? `답 ${answerLabel(value)}` : '답함'}</span>
                          <span className="text-muted">{formatNumber(group.count)}건</span>
                          <span className="text-muted">{formatWon(group.totalAmount)}</span>
                        </p>
                      </div>
                      <IconButton
                      icon={open ? XIcon : PencilIcon}
                      label={`${group.questionText} ${open ? '닫기' : '답 바꾸기'}`}
                      aria-expanded={open}
                      disabled={locked}
                      onClick={() => setEditing(open ? null : key)} />
                    </div>
                    {/* 답을 바꿔도 펼친 채 둔다. 접히면 아래 줄이 포인터 밑으로 올라온다 */}
                    {open &&
                  <fieldset disabled={locked} className={locked ? 'mt-3 opacity-60' : 'mt-3'}>
                        <ChoiceGroup
                      name={`${group.questionText} 답 바꾸기`}
                      columns={group.options.length >= 3 ? 3 : 2}
                      value={value ?? ''}
                      selectOnFocus={false}
                      numberKeys
                      onChange={(next) => void answer(group, next)}
                      onClear={() => void withdraw(group)}
                      options={choicesOf(group)} />

                      </fieldset>
                  }
                    {statusLine(key)}
                  </li>);

            })}
            </ul>
            {answeredQ.data && answeredQ.data.page.totalPages > 1 &&
          <Pagination page={answeredQ.data.page} onChange={setAnsweredPage} />
          }
          </section>
        }

        {/* 질문을 읽기 전에는 다음으로 넘기지 않는다 (C66) */}
        {!loading &&
        <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button to="/summary" className="whitespace-nowrap">
              요약으로
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        }
      </div>
      <ShortcutHelp shortcuts={SHORTCUTS} />
    </AppShell>);

}
