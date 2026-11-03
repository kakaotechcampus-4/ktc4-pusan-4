import type { Judgment, LimitYear } from '../types/domain';

/** 한도가 있는 계정과목(접대비). 백엔드 한도 묶음(`limit_bucket`) 이름과 같다 */
export const LIMITED_ACCOUNT = '접대비';

/** 응답의 `limits` 에서 접대비 묶음만 연도순으로 (#226) */
export const limitsOf = (limits: LimitYear[]) =>
limits.filter((item) => item.bucket === LIMITED_ACCOUNT).sort((a, b) => a.taxYear - b.taxYear);

/**
 * 이 판정이 한도를 넘은 해의 가능 접대비면 그해 한도 (#226).
 * 넘은 해의 거래별 인정액은 배분 순서로만 정해져(#15) 화면은 금액 대신 「연간 한도 대상」으로 적는다.
 * 승인취소·환불(음수 금액)은 서버가 한도에 넣지 않고 인정 금액을 그대로 주므로 빼낸다(LimitSettlementService)
 */
export const exceededLimitOf = (judgment: Judgment, limits: LimitYear[]) =>
judgment.verdict.code === 'AVAILABLE' && (judgment.finalAmount ?? judgment.transaction.amount) >= 0 ?
limits.find(
  (item) =>
  item.excessAmount > 0 &&
  item.bucket === judgment.attributes.limit_bucket &&
  String(item.taxYear) === judgment.transaction.approvedAt.slice(0, 4)
) :
undefined;
