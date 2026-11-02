import type { JudgmentExportRow } from '../types/domain';

/** 한도가 있는 계정과목(접대비). 백엔드 한도 버킷 이름과 같다 */
export const LIMITED_ACCOUNT = '접대비';

/**
 * 한도를 넘어 인정 금액에서 빠진 접대비(#202). 내보내기의 finalAmount 와 allowedAmount(한도 인정액)의 차이를 더한다.
 * 요약과 같은 기준이라 요약 합계와 결과 목록 합의 차이가 이 값이다. 「확인 필요」는 allowedAmount 가 0 이라 넣지 않는다
 */
export const limitExcess = (rows: JudgmentExportRow[]) =>
rows.reduce(
  (sum, { judgment, allowedAmount }) =>
  judgment.verdict.code === 'AVAILABLE' && judgment.account === LIMITED_ACCOUNT ?
  sum + Math.max(0, (judgment.finalAmount ?? 0) - allowedAmount) :
  sum,
  0
);
