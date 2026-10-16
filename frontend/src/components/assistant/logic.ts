import { ApiRequestError } from '../../api';
import type { Api } from '../../api';
import type {
  AssistantMessage,
  AssistantProposal,
  QuestionGroup,
  QuestionSuggestion } from
'../../types/domain';
import { formatNumber, ro } from '../../utils/format';

/** 9장 요청 규칙 */
export const MESSAGE_CHARS = 1000;
const HISTORY_LIMIT = 20;
const HISTORY_CHARS = 2000;

/** 최근 20개, 각 2,000자. 서버는 대화를 저장하지 않아 매번 보낸다 */
export const trimHistory = (messages: AssistantMessage[]): AssistantMessage[] =>
messages.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content.slice(0, HISTORY_CHARS) }));

/**
 * 비서가 이동을 제안할 수 있는 화면과 그 이름 (ai/assistant/tools.py ROUTES 와 같다).
 * 판정 실행(/run)은 판정 전 확인을 건너뛰므로 뺀다. 목록 밖의 경로는 따라가지 않는다
 */
export const ASSISTANT_ROUTES: Record<string, string> = {
  '/upload': '카드내역',
  '/preview': '분류 확인',
  '/interview': '사업자 문진',
  '/confirm': '판정 전 확인',
  '/results': '결과',
  '/questions': '질문',
  '/summary': '요약',
  '/transactions': '거래',
  '/uploads': '업로드 이력'
};

export const PROPOSAL_LABEL: Record<AssistantProposal['kind'], string> = {
  answer: '질문 답',
  bulk_answer: '한 번에 답하기',
  classification: '가맹점 분류',
  override: '판정 수정',
  navigation: '화면 이동',
  handoff_note: '세무대리인 질문'
};

/** [적용]할 수 없는 카드면 그 까닭, 할 수 있으면 null */
export const blockedReason = (proposal: AssistantProposal): string | null =>
proposal.kind === 'override' && proposal.toVerdict === 'NEEDS_REVIEW' ?
// 확인 필요로 되돌리면 질문 없는 확인 필요가 된다 (#62)
'확인 필요로는 바꿀 수 없어 적용하지 않습니다. 결과 화면에서 가능·불가 중에 골라 주세요.' :
proposal.kind === 'navigation' && !(proposal.route in ASSISTANT_ROUTES) ?
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
      return '세무대리인 질문에 넣었습니다. 요약 화면의 넘길 문장에 들어갑니다.';
  }
}

/** 서버 문장은 그대로 띄우지 않는다. 상태 코드로 고른다 */
export const chatErrorText = (caught: unknown): string => {
  const status = caught instanceof ApiRequestError ? caught.status : -1;
  if (status === 429) {
    const seconds = caught instanceof ApiRequestError ? caught.retryAfter : undefined;
    return seconds !== undefined && seconds <= 60 ?
    `${formatNumber(seconds)}초 뒤에 다시 물어봐 주세요.` :
    '지금은 더 받을 수 없습니다. 잠시 뒤 다시 물어봐 주세요.';
  }
  if (status === 400 || status === 422) return '보낸 내용을 받지 못했습니다. 질문을 짧게 다시 적어 주세요.';
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
      text: `${suggestion.sourceLabel}에서 '${suggestion.value}'${ro(suggestion.value)} 답했습니다.`
    };
    const history = (suggestion.history ?? []).filter((item) => allowed(item.value));
    return history.length > 0 ?
    {
      kind: 'history',
      text: `지난 답이 서로 다릅니다: ${history.map((item) => `${item.sourceLabel} '${item.value}'`).join(' · ')}`
    } :
    null;
  }
  const counts = Object.entries(suggestion.historyCounts ?? {}).filter(([value]) => allowed(value));
  return counts.length > 0 ?
  { kind: 'history', text: `이 가맹점 지난 답: ${counts.map(([value, n]) => `${value} ${formatNumber(n)}`).join(' · ')}` } :
  null;
}
