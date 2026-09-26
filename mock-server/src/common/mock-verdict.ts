import type { Verdict } from './coded';

const AVAILABLE_LIKE = new Set([
  '해외SaaS', '국내SW', '여비교통', '도서', '교육', '광고', '사무용품', '임차료', '전문가수수료', '구독서비스',
]);
const UNAVAILABLE_LIKE = new Set(['지자체_과태료', '경찰청_범칙금', '조세', '의료', '게임', '여가', '미용']);
/**
 * 룰엔진 판정 "범위 밖(핸드오프)" 성격의 카테고리. backend는 룰카드 out_of_scope에서
 * 결정하지만 mock엔 룰카드가 없으므로 이 소집합으로 흉내낸다. 이들은 pickVerdictForCategory
 * 상 NEEDS_REVIEW로 떨어지며, 그때만 outOfScope=true가 된다(불변식).
 *
 * 실제 out_of_scope=true 카드는 R-070(차량)·R-071(급여원천세)뿐이고 R-071은 category를
 * 걸지 않으므로, 카테고리 근사로는 '차량'만 해당한다. 'PG_미상'(R-105)은 out_of_scope가
 * 아니라 되묻기 대기(question 보유)라 여기 넣지 않는다.
 */
const OUT_OF_SCOPE_LIKE = new Set(['차량']);

/**
 * 실제 6관문 룰카드 엔진(backend/judgment/domain)은 옮기지 않는다. mock은
 * docs/categories.md의 '세무 성격'을 대략 반영하는 카테고리→verdict 매핑 하나로
 * 재판정 결과를 흉내낸다 — 판정 로직의 정확성은 이 mock의 목적이 아니다.
 */
export function pickVerdictForCategory(category: string): Verdict {
  if (AVAILABLE_LIKE.has(category)) return 'AVAILABLE';
  if (UNAVAILABLE_LIKE.has(category)) return 'UNAVAILABLE';
  return 'NEEDS_REVIEW';
}

export interface MockJudgmentFields {
  blockedAtGate: string | null;
  account: string | null;
  finalAmount: number | null;
  outOfScope: boolean;
}

/** verdict=NEEDS_REVIEW이고 범위 밖 카테고리일 때만 true. 불변식: 그 외 verdict에서는 항상 false. */
export function isOutOfScope(verdict: Verdict, category: string): boolean {
  return verdict === 'NEEDS_REVIEW' && OUT_OF_SCOPE_LIKE.has(category);
}

/**
 * verdict/category에 따른 account/finalAmount/blockedAtGate/outOfScope를 만드는 규칙 하나를
 * 모든 mock 판정 생성 경로(judgment-runs, classification-responses)가 공유한다 — 경로마다
 * 따로 정하면 같은 verdict인데 계정과목/금액/범위 밖 여부가 갈리는 불일치가 생긴다.
 */
export function mockJudgmentFields(verdict: Verdict, amount: number, category: string): MockJudgmentFields {
  const outOfScope = isOutOfScope(verdict, category);
  if (verdict === 'AVAILABLE') return { blockedAtGate: null, account: '소모품비', finalAmount: amount, outOfScope };
  if (verdict === 'UNAVAILABLE') return { blockedAtGate: 'G1', account: null, finalAmount: null, outOfScope };
  return { blockedAtGate: 'G2', account: null, finalAmount: null, outOfScope };
}
