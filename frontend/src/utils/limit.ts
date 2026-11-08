import type { Judgment, LimitYear } from '../types/domain';
import { formatWon } from './format';

/** 한도가 있는 계정과목 ID(접대비). 백엔드 한도 묶음(`limit_bucket`) 이름과 같다. 화면에는 bucketLabel 을 보인다 */
export const LIMITED_ACCOUNT = '접대비';

/** 한도는 최신 문진의 직전연도 수입금액으로 잡고, 확정 기능이 없어 늘 잠정이다(CONTEXT.md A6b) */
export const PROVISIONAL_NOTE = '직전연도 수입금액 기준 잠정';

/** 응답의 `limits` 에서 접대비 묶음만 연도순으로 (#226) */
export const limitsOf = (limits: LimitYear[]) =>
limits.filter((item) => item.bucket === LIMITED_ACCOUNT).sort((a, b) => a.taxYear - b.taxYear);

/**
 * 「2026년 기업업무추진비 한도 12,090,000원 중 300,000원」.
 * 넘었으면 「2026년 기업업무추진비 13,006,500원, 한도 12,090,000원에서 916,500원 초과」
 */
export const limitLine = ({ taxYear, bucketLabel, limitAmount, totalAmount, excessAmount }: LimitYear) =>
excessAmount > 0 ?
`${taxYear}년 ${bucketLabel} ${formatWon(totalAmount)}, 한도 ${formatWon(limitAmount)}에서 ${formatWon(excessAmount)} 초과` :
`${taxYear}년 ${bucketLabel} 한도 ${formatWon(limitAmount)} 중 ${formatWon(totalAmount)}`;

/**
 * batch 합계 아래에 붙일 한도 초과 안내. 넘은 해가 없으면 null.
 * 초과액은 그해 모든 업로드를 합친 값이라 이 업로드 몫을 정할 수 없다(#15). 합계에서 빼지 않았다고 해마다 밝힌다
 */
export const excessNote = (limits: LimitYear[]) => {
  const exceeded = limitsOf(limits).filter((item) => item.excessAmount > 0);
  return exceeded.length > 0 ?
  `${exceeded.map((item) => `${item.taxYear}년 ${item.bucketLabel}가 연간 한도를 ${formatWon(item.excessAmount)} 넘었습니다.`).join(' ')} 넘은 금액은 경비에 들어가지 않지만 위 금액에서는 빼지 않았습니다.` :
  null;
};

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
