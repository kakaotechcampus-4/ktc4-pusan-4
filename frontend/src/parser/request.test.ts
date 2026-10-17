import { describe, expect, it } from 'vitest';
import type { UploadBatchRequest } from '../types/domain';
import { toRequest, unsendableOf } from './request';
import { serverValidate } from './serverValidate.testutil';
import type { ParsedRow } from './types';

const row = (fields: Partial<ParsedRow> = {}): ParsedRow => ({
  approvedAt: '2026-01-03',
  rawMerchant: '가맹점',
  amount: 1000,
  installmentMonths: 0,
  approvalNo: '12345678',
  naturalKey: '721607a430d35bfd',
  bizNo: '',
  memo: '',
  sourceCard: 'kb',
  status: '판정대상',
  isAggregated: false,
  needsReview: false,
  reviewReason: '',
  isCancel: false,
  masked: false,
  ...fields
});

describe('unsendableOf', () => {
  it('보낼 수 있는 행은 null 이다', () => {
    expect(unsendableOf(row())).toBeNull();
  });

  it('사유마다 코드를 돌려준다', () => {
    expect(unsendableOf(row({ approvedAt: '', naturalKey: '' }))).toBe('NO_DATE');
    expect(unsendableOf(row({ amount: null, naturalKey: '' }))).toBe('NO_AMOUNT');
    expect(unsendableOf(row({ rawMerchant: '' }))).toBe('BLANK_MERCHANT');
    expect(unsendableOf(row({ approvalNo: '1'.repeat(33) }))).toBe('APPROVAL_TOO_LONG');
    expect(unsendableOf(row({ approvalNo: '1'.repeat(32) }))).toBeNull();
  });

  it('먼저 걸린 사유 하나만 돌려준다', () => {
    expect(unsendableOf(row({ approvedAt: '', amount: null, rawMerchant: '' }))).toBe('NO_DATE');
  });
});

describe('toRequest', () => {
  it('상태·카드사를 계약 값으로 바꾸고 분기 필드는 보내지 않는다', () => {
    const rows = [
      row(),
      row({ approvedAt: '2026-01-12', amount: -39000, status: '취소상계', isCancel: true, naturalKey: 'b9119080c84cc753' }),
      row({ approvedAt: '2026-01-15', status: '대상제외', reviewReason: '정산 행', naturalKey: 'aaaaaaaaaaaaaaaa' })
    ];
    const { request, unsendable } = toRequest(rows, 'kb', 'sha256:ab', null);
    expect(unsendable).toEqual([]);
    expect(request?.cardIssuer).toBe('국민');
    expect(request?.sourceType).toBe('승인내역');
    expect(request?.transactions.map((t) => t.status)).toEqual(['JUDGEABLE', 'CANCELED_OFFSET', 'EXCLUDED']);
    expect(request?.transactions[1].amount).toBe(-39000);
    for (const t of request?.transactions ?? []) {
      expect(t).not.toHaveProperty('branch');
      expect(t).not.toHaveProperty('branchRaw');
    }
    expect(toRequest(rows, 'ibk', 'sha256:ab', null).request?.cardIssuer).toBe('기업');
  });

  it('보낼 수 없는 행은 원래 위치와 함께 따로 모은다', () => {
    const rows = [row(), row({ approvedAt: '', naturalKey: '' }), row({ amount: null, naturalKey: '' })];
    const { request, unsendable } = toRequest(rows, 'kb', 'sha256:ab', null);
    expect(request?.transactions).toHaveLength(1);
    expect(unsendable.map((u) => [u.index, u.code])).toEqual([[1, 'NO_DATE'], [2, 'NO_AMOUNT']]);
  });

  it('보낼 행이 하나도 없으면 request 는 null 이다', () => {
    expect(toRequest([], 'kb', 'sha256:ab', null).request).toBeNull();
    expect(toRequest([row({ approvedAt: '', naturalKey: '' })], 'kb', 'sha256:ab', null).request).toBeNull();
  });

  it('선언된 기간이 있으면 그것을, 없으면 보내는 행의 최소·최대 날짜를 쓴다', () => {
    const rows = [row({ approvedAt: '2026-03-31' }), row({ approvedAt: '2026-01-03' }), row({ approvedAt: '' , naturalKey: '' })];
    const declared = toRequest(rows, 'kb', 'h', { start: '2026-01-01', end: '2026-03-31' }).request;
    expect([declared?.periodStart, declared?.periodEnd]).toEqual(['2026-01-01', '2026-03-31']);
    const spanned = toRequest(rows, 'ibk', 'h', null).request;
    expect([spanned?.periodStart, spanned?.periodEnd]).toEqual(['2026-01-03', '2026-03-31']);
  });

  it('뒤집힌 선언 기간은 쓰지 않는다', () => {
    const req = toRequest([row()], 'kb', 'h', { start: '2026-03-31', end: '2026-01-01' }).request;
    expect([req?.periodStart, req?.periodEnd]).toEqual(['2026-01-03', '2026-01-03']);
  });

  it('서버 검증을 통과한다', () => {
    const rows = [row(), row({ approvedAt: '2026-02-01', bizNo: '123-45-67890', memo: '메모' })];
    const { request } = toRequest(rows, 'ibk', 'sha256:ab', null);
    expect(serverValidate(request as UploadBatchRequest)).toEqual([]);
  });
});
