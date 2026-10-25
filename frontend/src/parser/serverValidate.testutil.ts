import type { UploadBatchRequest } from '../types/domain';

/** 백엔드 UploadRequestValidator(#129) 규칙의 포트. 서버가 받아 주는지를 브라우저에서 미리 확인한다 */
export function serverValidate(req: UploadBatchRequest): string[] {
  const errors: string[] = [];
  if (req.sourceType !== '승인내역') errors.push('INVALID_SOURCE_TYPE');
  if (req.transactions.length === 0) errors.push('EMPTY_TRANSACTIONS');
  if (req.periodEnd < req.periodStart) errors.push('PERIOD_ORDER');
  for (const t of req.transactions) {
    if (!t.naturalKey) errors.push('MISSING_NATURAL_KEY');
    if (!t.approvedAt) errors.push('NULL_APPROVED_AT');
    if (t.amount === null || t.amount === undefined) errors.push('NULL_AMOUNT');
    if (!t.status) errors.push('NULL_STATUS');
    if (!t.merchantRaw.trim()) errors.push('BLANK_MERCHANT');
    if ((t.approvalNo ?? '').length > 32) errors.push('APPROVAL_TOO_LONG');
    if ((t.bizNo ?? '').length > 20) errors.push('BIZNO_TOO_LONG');
  }
  return errors;
}
