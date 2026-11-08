import type { Judgment, LimitYear } from '../types/domain';
import { formatWon } from './format';

/** 한도가 있는 계정과목(접대비). 백엔드 한도 묶음(`limit_bucket`) 이름과 같다 */
export const LIMITED_ACCOUNT = '접대비';

/** 한도는 최신 문진의 직전연도 수입금액으로 잡고, 확정 기능이 없어 늘 잠정이다(CONTEXT.md A6b) */
export const PROVISIONAL_NOTE = '직전연도 수입금액 기준 잠정';

/** 응답의 `limits` 에서 접대비 묶음만 연도순으로 (#226) */
export const limitsOf = (limits: LimitYear[]) =>
limits.filter((item) => item.bucket === LIMITED_ACCOUNT).sort((a, b) => a.taxYear - b.taxYear);

/** 「2026년 접대비 총 14,000,000원 중 한도 초과 1,750,000원」. 한도 안이면 「… 한도 안」 */
export const limitLine = ({ taxYear, totalAmount, excessAmount }: LimitYear) =>
excessAmount > 0 ?
`${taxYear}년 접대비 총 ${formatWon(totalAmount)} 중 한도 초과 ${formatWon(excessAmount)}` :
`${taxYear}년 접대비 총 ${formatWon(totalAmount)}, 한도 안`;

/**
 * batch 합계 아래에 붙일 한도 초과 안내. 넘은 해가 없으면 null.
 * 초과액은 그해 모든 업로드를 합친 값이라 이 업로드 몫을 정할 수 없다(#15). 합계에서 빼지 않았다고 해마다 밝힌다
 */
export const excessNote = (limits: LimitYear[]) => {
  const exceeded = limitsOf(limits).filter((item) => item.excessAmount > 0);
  return exceeded.length > 0 ?
  `${exceeded.map((item) => `${item.taxYear}년 접대비가 연간 한도를 ${formatWon(item.excessAmount)} 넘었습니다.`).join(' ')} 넘은 금액은 경비에 들어가지 않지만 위 금액에서는 빼지 않았습니다.` :
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
