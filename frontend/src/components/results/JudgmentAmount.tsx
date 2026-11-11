import type { Judgment, LimitYear } from '../../types/domain';
import { formatWon } from '../../utils/format';
import { exceededLimitOf } from '../../utils/limit';

/** 판정 표의 금액 칸. 결과(업로드 하나)와 연간 결과(한 해)가 같이 쓴다 */
export function JudgmentAmount({ row, limits }: {row: Judgment;limits: LimitYear[];}) {
  const { transaction } = row;
  // 「일부 인정」은 AVAILABLE + finalAmount < amount 다 (2.1).
  // 자산은 그해 넣을 수 있는 한도라 「최대」로 쓴다 (CONTEXT.md G4 화면 문구)
  const asset = row.attributes['자산'] === true;
  const partial =
  row.verdict.code === 'AVAILABLE' &&
  row.finalAmount !== null && (
  asset || row.finalAmount !== transaction.amount);
  // 한도를 넘은 해의 접대비는 거래별 금액이 없다(#226). 금액 대신 한도 대상임을 적는다
  const overLimit = exceededLimitOf(row, limits);
  return (
    <span className="block">
        <span className="whitespace-nowrap font-bold text-ink">{formatWon(transaction.amount)}</span>
        {overLimit ?
      <span className="block whitespace-nowrap text-caption text-ink2">연간 한도 대상</span> :
      partial && row.finalAmount !== null &&
      <span className="block whitespace-nowrap text-caption text-ink2">
              {asset ? '최대' : '경비 가능'} {formatWon(row.finalAmount)}
            </span>
      }
      </span>);

}
