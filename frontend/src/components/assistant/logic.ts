import { ApiRequestError } from '../../api';
import type { Api } from '../../api';
import type {
  AssistantMessage,
  AssistantProposal,
  NextStep,
  Progress,
  QuestionGroup,
  QuestionSuggestion } from
'../../types/domain';
import { formatNumber, ro } from '../../utils/format';
import { answerLabel } from '../questions/logic';

/** 9장 요청 규칙 */
export const MESSAGE_CHARS = 1000;
const HISTORY_LIMIT = 20;
const HISTORY_CHARS = 2000;

/** 최근 20개, 각 2,000자. 서버는 대화를 저장하지 않아 매번 보낸다 */
export const trimHistory = (messages: AssistantMessage[]): AssistantMessage[] =>
messages.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content.slice(0, HISTORY_CHARS) }));

/**
 * 비서에게 보낼 대화. 화면이 혼자 답한 문답(도움말·다음 할 일)은 뺀다 — 비서가 하지 않은 말을 비서의 말로
 * 넘기지 않고, 긴 도움말 문구가 20개 한도를 차지하지 않게 한다
 */
export const historyOf = (entries: {role: AssistantMessage['role'];content: string;local?: boolean;}[]): AssistantMessage[] =>
trimHistory(entries.filter((entry) => !entry.local).map(({ role, content }) => ({ role, content })));

/**
 * 비서가 이동을 제안할 수 있는 화면과 그 이름. 경로는 ai/assistant/tools.py ROUTES 와 같고, 이름은 화면 이름을 따른다.
 * 판정 실행(/run)은 판정 전 확인을 건너뛰므로 뺀다. 목록 밖의 경로는 따라가지 않는다
 */
export const ASSISTANT_ROUTES: Record<string, string> = {
  '/upload': '카드내역 올리기',
  '/preview': '분류 확인',
  '/interview': '사업자 문진',
  '/confirm': '판정 전 확인',
  '/results': '결과',
  '/questions': '질문',
  '/summary': '요약',
  '/transactions': '거래',
  '/uploads': '업로드 이력'
};

/** 목록 안의 경로면 그 화면 이름. `in` 은 constructor·toString 같은 상속 키도 통과시켜 쓰지 않는다 */
export const routeName = (route: string): string | undefined =>
Object.prototype.hasOwnProperty.call(ASSISTANT_ROUTES, route) ? ASSISTANT_ROUTES[route] : undefined;

export const PROPOSAL_LABEL: Record<AssistantProposal['kind'], string> = {
  answer: '질문 답',
  bulk_answer: '한 번에 답하기',
  classification: '가맹점 분류',
  override: '판정 수정',
  navigation: '화면 이동',
  handoff_note: '세무사 질문'
};

/** 「다음에 할 일」에서 단계마다 하는 말. [다른 화면에 있을 때, 그 화면에 이미 있을 때] */
const NEXT_TEXT: Record<NextStep, [away: string, here: string]> = {
  CLASSIFY: ['분류가 필요한 가맹점이 남았습니다.', '이 화면에서 분류가 필요한 가맹점의 업종을 골라 주세요.'],
  INTERVIEW: ['판정 전에 사업자 문진에 답해 주세요.', '이 화면의 사업자 문진에 답하면 판정을 시작할 수 있습니다.'],
  CONFIRM: ['판정을 아직 시작하지 않았습니다.', '이 화면에서 판정을 시작할 수 있습니다.'],
  QUESTIONS: ['답할 질문이 남았습니다.', '이 화면에 답할 질문이 남았습니다.'],
  RESULTS: ['답할 질문이 없습니다. 결과를 확인해 주세요.', '답할 질문이 없습니다. 요약에서 세무사에게 넘길 내용을 볼 수 있습니다.']
};

/**
 * 「다음에 할 일」의 답 (C106). 서버의 next 를 따르되 지금 그 화면에 있으면 그리로 보내지 않는다 —
 * 결과 화면에서 결과 보기로 가라고 하면 할 일을 알려 주지 못한 것이다. 결과까지 다 봤으면 요약을 권한다.
 * 질문이 남았으면 서버가 이미 질문을 먼저 준다(NextStep.java). route 가 null 이면 이동 카드를 붙이지 않는다
 */
export function nextAnswer(next: Progress['next'], pathname: string): {content: string;route: string | null;} {
  const [away, here] = NEXT_TEXT[next.step] ?? [`다음 할 일은 ${next.label}입니다.`, '지금 화면에서 이어서 하면 됩니다.'];
  if (next.route !== pathname) return { content: away, route: next.route };
  return { content: here, route: next.step === 'RESULTS' ? '/summary' : null };
}

/** [적용]할 수 없는 카드면 그 까닭, 할 수 있으면 null */
export const blockedReason = (proposal: AssistantProposal): string | null =>
proposal.kind === 'override' && proposal.toVerdict === 'NEEDS_REVIEW' ?
// 확인 필요로 되돌리면 질문 없는 확인 필요가 된다 (#62)
'확인 필요로는 바꿀 수 없어 적용하지 않습니다. 결과 화면에서 가능이나 불가 중에 골라 주세요.' :
proposal.kind === 'navigation' && routeName(proposal.route) === undefined ?
'이동할 수 없는 화면입니다.' :
null;

/**
 * [적용]. AI 가 준 경로를 부르지 않고 kind 를 보고 기존 API 를 고른다 (9장).
 * idempotencyKey 는 카드마다 하나다 — 응답을 못 받아 다시 눌러도 같은 수정이 두 번 생기지 않는다.
 * 돌려주는 것은 카드 아래에 띄울 결과 문장이다
 */
export async function applyProposal(
api: Api,
proposal: AssistantProposal,
navigate: (route: string) => void,
idempotencyKey: string)
: Promise<string> {
  switch (proposal.kind) {
    case 'answer':{
        const result = await api.questions.respond({
          questionIds: proposal.questionIds,
          answer: { value: proposal.value },
          source: proposal.source
        });
        return `답을 저장하고 거래 ${formatNumber(result.rejudgedTransactionCount)}건을 다시 판정했습니다.`;
      }
    case 'bulk_answer':{
        const result = await api.questions.bulkAnswer({
          batchId: proposal.batchId,
          factType: proposal.factType,
          answer: { value: proposal.value }
        });
        return `질문 ${formatNumber(result.answeredCount)}건에 답했습니다.`;
      }
    case 'classification':{
        const result = await api.classificationReviews.respond({
          reviewIds: proposal.reviewIds,
          merchantCategory: proposal.merchantCategory
        });
        return `거래 ${formatNumber(result.resolvedCount)}건을 ${proposal.merchantCategory}${ro(proposal.merchantCategory)} 정했습니다.`;
      }
    case 'override':
      await api.judgments.override(
        proposal.judgmentId,
        { toVerdict: proposal.toVerdict, reason: proposal.reason },
        idempotencyKey
      );
      return '판정을 바꿨습니다. 이전 판정은 이력에 남아 있습니다.';
    case 'navigation':
      navigate(proposal.route);
      return '화면을 옮겼습니다.';
    case 'handoff_note':
      await api.handoffNotes.create({ text: proposal.text, transactionIds: proposal.transactionIds });
      return '세무사 질문에 넣었습니다. 요약 화면의 넘길 문장에 들어갑니다.';
  }
}

/**
 * 서버 문장은 그대로 띄우지 않는다. code 와 상태 코드로 고른다 (api.md POST /assistant/chat).
 * 429 는 모두 ASSISTANT_RATE_LIMITED 라 Retry-After 로 가른다 — 하루 한도는 자정까지라 1분보다 길다
 */
export const chatErrorText = (caught: unknown): string => {
  const status = caught instanceof ApiRequestError ? caught.status : -1;
  const code = caught instanceof ApiRequestError ? caught.code : '';
  if (status === 429) {
    const seconds = caught instanceof ApiRequestError ? caught.retryAfter : undefined;
    if (seconds !== undefined && seconds > 60) return '오늘 물어볼 수 있는 만큼 다 물었습니다. 내일 다시 물어봐 주세요.';
    // 0 초는 「0초 뒤」로 읽혀 기다릴 것이 없는 것처럼 보인다. 기다릴 시간을 모를 때와 같게 적는다
    return seconds !== undefined && seconds > 0 ?
    `${formatNumber(seconds)}초 뒤에 다시 물어봐 주세요.` :
    '지금은 더 받을 수 없습니다. 잠시 뒤 다시 물어봐 주세요.';
  }
  if (code === 'BATCH_NOT_FOUND')
  return '보던 업로드를 찾을 수 없습니다. 지워졌을 수 있어 남은 업로드에서 다시 고릅니다. 다시 보내 주세요.';
  if (code === 'TRANSACTION_NOT_FOUND') return '보던 거래를 찾을 수 없습니다. 거래를 빼고 다시 물어봅니다. 다시 보내 주세요.';
  if (status === 400) return '보낸 내용을 받지 못했습니다. 질문을 짧게 다시 적어 주세요.';
  if (status === 0) return '서버에 연결하지 못했습니다. 잠시 뒤 다시 물어봐 주세요.';
  return '지금은 답하지 못했습니다. 잠시 뒤 다시 물어봐 주세요. 화면 안내는 그대로 쓸 수 있습니다.';
};

export const applyErrorText = (caught: unknown): string =>
caught instanceof ApiRequestError && caught.status === 409 ?
'그사이 바뀌어 적용하지 못했습니다. 화면을 다시 불러왔습니다.' :
caught instanceof ApiRequestError && (caught.status === 400 || caught.status === 422) ?
'지금 상태에서는 적용할 수 없습니다. 화면에서 직접 확인해 주세요.' :
'적용하지 못했습니다. 잠시 뒤 다시 눌러 주세요.';

/** 질문 카드에 붙이는 지난번 답 (명세 3.1) */
export type PreviousAnswer =
/** A 이어받기: 값과 출처를 보여 주고 그 값으로 답할 수 있다 */
{kind: 'apply';value: string;text: string;} |
/** 충돌한 A, B 이력만: 미리 고르지 않는다 */
{kind: 'history';text: string;};

export function previousAnswer(
group: QuestionGroup,
suggestion: QuestionSuggestion | undefined)
: PreviousAnswer | null {
  if (!suggestion || suggestion.tier === 'C') return null;
  // 지금 선택지에 없는 값은 버린다
  const allowed = (value: string) => group.options.includes(value);
  if (suggestion.tier === 'A') {
    // 소명 대기 질문은 사용자가 직접 밝힌 사정만 근거가 된다. 지난 답으로 채우지 않는다
    if (
    !suggestion.conflict &&
    suggestion.value &&
    suggestion.sourceLabel &&
    allowed(suggestion.value) &&
    group.bulkAnswerable)

    return {
      kind: 'apply',
      value: suggestion.value,
      text: `${suggestion.sourceLabel}에서 ${answerLabel(suggestion.value)}${ro(answerLabel(suggestion.value))} 답했습니다.`
    };
    const history = (suggestion.history ?? []).filter((item) => allowed(item.value));
    // 충돌이 아니라 가장 최근 답이 일괄 응답이라 값을 주지 않은 경우다. 「서로 다르다」고 하면 틀린 말이 된다
    if (!suggestion.conflict && history[0]?.bulk)
    return {
      kind: 'history',
      text: `${history[0].sourceLabel}에서는 한 번에 답하기로 ${answerLabel(history[0].value)}${ro(answerLabel(history[0].value))} 답했습니다. 이번에는 직접 골라 주세요.`
    };
    return history.length > 0 ?
    {
      kind: 'history',
      text: `지난 답이 서로 다릅니다: ${history.map((item) => `${item.sourceLabel} ${answerLabel(item.value)}`).join(', ')}`
    } :
    null;
  }
  const counts = Object.entries(suggestion.historyCounts ?? {}).filter(([value]) => allowed(value));
  return counts.length > 0 ?
  { kind: 'history', text: `이 가맹점 지난 답: ${counts.map(([value, n]) => `${answerLabel(value)} ${formatNumber(n)}건`).join(', ')}` } :
  null;
}
