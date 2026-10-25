import type { SourceStatus, UploadBatchRequest } from '../types/domain';
import type { AdapterResult, ParsedRow, ParserStatus, SourceCard, UnsendableCode, UnsendableRow } from './types';

const MAX_APPROVAL_NO = 32;

const STATUS: Record<ParserStatus, SourceStatus> = {
  판정대상: 'JUDGEABLE',
  취소상계: 'CANCELED_OFFSET',
  대상제외: 'EXCLUDED'
};

const ISSUER = { kb: '국민', ibk: '기업' } as const;

/** 서버(UploadRequestValidator)가 배치 전체를 거절하게 만드는 행인지 본다. 먼저 걸린 사유 하나만 돌려준다 */
export function unsendableOf(row: ParsedRow): UnsendableCode | null {
  if (row.approvedAt === '') return 'NO_DATE';
  if (row.amount === null) return 'NO_AMOUNT';
  if (row.rawMerchant === '') return 'BLANK_MERCHANT';
  if (row.approvalNo.length > MAX_APPROVAL_NO) return 'APPROVAL_TOO_LONG';
  return null;
}

export function toRequest(
rows: ParsedRow[],
issuer: SourceCard,
fileHash: string,
declaredPeriod: AdapterResult['declaredPeriod'])
: {request: UploadBatchRequest | null;unsendable: UnsendableRow[];} {
  const unsendable: UnsendableRow[] = [];
  const transactions: UploadBatchRequest['transactions'] = [];

  rows.forEach((row, index) => {
    const code = unsendableOf(row);
    if (code !== null || row.amount === null) {
      unsendable.push({ index, code: code ?? 'NO_AMOUNT', row });
      return;
    }
    transactions.push({
      approvedAt: row.approvedAt,
      merchantRaw: row.rawMerchant,
      amount: row.amount,
      naturalKey: row.naturalKey,
      status: STATUS[row.status],
      installmentMonths: row.installmentMonths,
      approvalNo: row.approvalNo,
      bizNo: row.bizNo,
      memo: row.memo,
      isAggregated: row.isAggregated,
      needsReview: row.needsReview,
      reviewReason: row.reviewReason,
      sourceCard: row.sourceCard
    });
  });

  if (transactions.length === 0) return { request: null, unsendable };

  // ISO 날짜는 사전순이 곧 시간순이다
  const dates = transactions.map((t) => t.approvedAt).sort();
  // 서버는 periodEnd < periodStart 를 거절하므로, 뒤집힌 선언 기간은 쓰지 않는다
  const declared = declaredPeriod && declaredPeriod.start <= declaredPeriod.end ? declaredPeriod : null;
  return {
    request: {
      sourceType: '승인내역',
      cardIssuer: ISSUER[issuer],
      periodStart: declared?.start ?? dates[0],
      periodEnd: declared?.end ?? dates[dates.length - 1],
      fileHash,
      transactions
    },
    unsendable
  };
}
