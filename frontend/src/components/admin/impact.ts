import type { RuleCandidate, Verdict } from '../../types/domain';
import type { EvalCaseInfo } from '../../types/rules';

/** 초안 카드에서 승인 전에 보는 것만 */
export interface DraftCard {
  gate: string | null;
  verdict: Verdict | null;
  citations: string[];
}

const VERDICT: Record<string, Verdict> = { 가능: 'AVAILABLE', 불가: 'UNAVAILABLE', 확인필요: 'NEEDS_REVIEW' };

/**
 * 읽은 초안 YAML 에서 관문, 판정, 인용을 꺼낸다. 모양이 카드가 아니면 null 이다.
 * 판정이 없는 초안(속성 관문)은 verdict 가 null 이다
 */
export function draftCard(parsed: unknown): DraftCard | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const card = parsed as Record<string, unknown>;
  const citations = Array.isArray(card.citations) ?
  card.citations.
  map((item) => item && typeof item === 'object' ? (item as Record<string, unknown>).id : item).
  filter((id): id is string => typeof id === 'string' && id.length > 0) :
  [];
  const verdict = typeof card.verdict === 'string' ? VERDICT[card.verdict] ?? null : null;
  return { gate: typeof card.gate === 'string' ? card.gate : null, verdict, citations };
}

/**
 * 조문 id 의 위계. 법령 코퍼스의 id 는 법령 이름(띄어쓰기 없이) 뒤에 조, 항, 호를 붙인다
 * (ai/pipeline/parse.py: 소득세법-33-1-5, 소득세법시행령-61-1-1). 행정규칙은 이름 뒤에 #일련번호가 붙고,
 * 판례, 해석례, 심판례는 그 낱말 뒤에 번호가 온다
 */
export type Authority = '법률' | '시행령' | '시행규칙' | '그 밖';

export function authorityOf(statuteId: string): Authority {
  const name = statuteId.split('-')[0];
  if (!name || name.includes('#') || ['판례', '해석례', '심판례'].includes(name)) return '그 밖';
  if (name.endsWith('시행규칙')) return '시행규칙';
  if (name.endsWith('시행령')) return '시행령';
  return name.endsWith('법') ? '법률' : '그 밖';
}

/** 법률, 시행령, 시행규칙 조문을 하나라도 인용하는가. 하위 근거만으로 선 초안은 승인하지 않는다 */
export const hasAuthority = (citations: string[]) => citations.some((id) => authorityOf(id) !== '그 밖');

/**
 * 후보와 업종, 카테고리가 겹치는 평가 사례. 업종을 적지 않은 사례는 어느 업종과도 겹친다고 본다
 */
export const overlappingCases = (candidate: Pick<RuleCandidate, 'merchantCategory' | 'industryCode'>, cases: readonly EvalCaseInfo[]) =>
cases.filter(
  (item) => item.category === candidate.merchantCategory && (item.industry === null || item.industry === candidate.industryCode)
);

/** 초안을 읽은 결과. 못 읽으면 알리기만 하고 승인을 막지 않는다 */
export type DraftState =
{status: 'none';} |
{status: 'loading';} |
{status: 'error';} |
{status: 'ok';card: DraftCard;};

/**
 * 초안 카드의 인용 상태를 한 문장으로. 위의 근거(후보가 찾은 조문)와 헷갈리지 않게 「초안 카드」라고 말한다.
 * 승인하면 초안 YAML 이 그대로 카드 파일이 되므로(ai/pipeline/promote.py) 근거가 있어도 초안에 인용이 없으면 막는다
 */
const CITATION_PROBLEM = {
  none: { says: '규칙 카드 초안에 인용 조문이 없습니다.', blocks: '규칙 카드 초안에 인용 조문이 없어 승인할 수 없습니다.' },
  lower: {
    says: '규칙 카드 초안이 법률, 시행령, 시행규칙 조문을 인용하지 않습니다.',
    blocks: '규칙 카드 초안이 법률, 시행령, 시행규칙 조문을 인용하지 않아 승인할 수 없습니다.'
  }
} as const;
const problemOf = (citations: string[]) => citations.length === 0 ? CITATION_PROBLEM.none : hasAuthority(citations) ? null : CITATION_PROBLEM.lower;

export const citationProblem = (citations: string[]): string | null => problemOf(citations)?.says ?? null;

/** 승인을 막는 까닭. 막지 않으면 null */
export function approveBlock(draft: DraftState): string | null {
  if (draft.status === 'none') return '초안이 없어 승인할 수 없습니다.';
  if (draft.status === 'loading') return '초안을 읽는 중입니다.';
  return draft.status === 'ok' ? problemOf(draft.card.citations)?.blocks ?? null : null;
}
