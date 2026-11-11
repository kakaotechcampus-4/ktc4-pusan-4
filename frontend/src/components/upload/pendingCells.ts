import type { UploadBatchRequest } from '../../types/domain';
import type { GridCell } from '../results/VerdictGrid';
import { merchantName } from '../results/display';
import { formatFullDate, formatWon } from '../../utils/format';

/**
 * 판정할 거래를 판정 전 칸으로. 취소상계와 대상제외는 보내기는 하지만 판정하지 않아 칸이 없다.
 * 판정을 마치면 결과 화면의 판정 칸 띠에서 같은 칸이 판정색이 된다
 */
export const pendingCells = (request: UploadBatchRequest | null): GridCell[] =>
(request?.transactions ?? []).
filter((transaction) => transaction.status === 'JUDGEABLE').
map((transaction, index) => ({
  key: `${transaction.naturalKey}:${index}`,
  state: 'PENDING' as const,
  date: transaction.approvedAt.slice(0, 10),
  tip: [merchantName(transaction.merchantRaw), formatFullDate(transaction.approvedAt), formatWon(transaction.amount)]
}));
