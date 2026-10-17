import { describe, expect, it } from 'vitest';
import { naturalKey } from './hash';
import {
  MedicalMasker,
  markNonTransactions,
  newStats,
  resolveCancellations,
  runPipeline,
  toRows } from
'./pipeline';
import { makeRecord } from './primitives';
import type { RecordFields } from './primitives';
import type { RawRecord } from './types';

type Fields = Partial<RecordFields>;

/** 가짜 레코드. 기본은 날짜 · 금액이 있고 승인번호가 없는 KB 정상결제다 */
function rec(fields: Fields = {}): RawRecord {
  return makeRecord({
    merchant: '가짜상점',
    amount: 10000,
    source: 'kb',
    approvalNo: '',
    when: '2026-01-10',
    installment: 0,
    isCancel: false,
    ...fields
  });
}

const cancel = (fields: Fields = {}) => rec({ isCancel: true, ...fields });

function resolve(records: RawRecord[]) {
  const stats = newStats(records.length, 0);
  resolveCancellations(markNonTransactions(records, stats), stats);
  return stats;
}

const AMBIGUOUS = (n: number) =>
`취소 대상 불확정 — 같은 상호·금액 결제가 ${n}건이라 어느 건이 취소됐는지 자동 판정 불가`;
const UNPAIRED = '취소 행 (짝 후보 없음 — 원 결제가 조회 기간 밖일 수 있다)';

describe('markNonTransactions', () => {
  it('사업자번호 없는 할인 · 포인트사용 행을 대상제외로 표시한다', () => {
    const records = [
    rec({ merchant: '정상할인' }),
    rec({ merchant: '포인트사용' }),
    rec({ merchant: '청구할인' }),
    rec({ merchant: '○○할인마트' }),
    rec({ merchant: '청구할인', bizNo: '123-45-67890' })];

    const stats = newStats(records.length, 0);
    expect(markNonTransactions(records, stats)).toBe(records);
    expect(records.map((r) => r.status)).toEqual(['대상제외', '대상제외', '대상제외', null, null]);
    expect(records[0].reviewReason).toBe('비거래 항목 (카드사 정산 행)');
    expect(stats.nonTransaction).toBe(3);
  });

  it('대상제외 행은 취소 페어링에 들어가지 않는다', () => {
    const records = [rec({ merchant: '청구할인' }), cancel({ merchant: '청구할인' })];
    const stats = resolve(records);
    expect(records.map((r) => r.status)).toEqual(['대상제외', '대상제외']);
    expect(stats.cancels).toBe(0);
  });
});

describe('resolveCancellations', () => {
  it('승인번호가 하나 맞으면 상호가 달라도 상계한다', () => {
    const o = rec({ merchant: '원래상호', approvalNo: '10000001' });
    const c = cancel({ merchant: '다른상호', approvalNo: '10000001', amount: -3000 });
    const records = [o, c];
    const stats = newStats(2, 0);
    expect(resolveCancellations(records, stats)).toBe(records);
    expect(o).toMatchObject({ status: '취소상계', reviewReason: '취소 상계 (승인번호 매칭)', needsReview: false });
    expect(c).toMatchObject({ status: '취소상계', reviewReason: '취소 행 (승인번호 매칭으로 상계됨)' });
    expect(stats).toMatchObject({ cancels: 1, cancelsPaired: 1, cancelsAmbiguous: 0, cancelsUnpaired: 0 });
  });

  it('폴백은 같은 상호 · 같은 절대금액 · 62일 이내만 짝짓는다', () => {
    const o = rec({ when: '2026-01-01' });
    const c = cancel({ amount: -10000, when: '2026-03-04' }); // 62일
    resolve([o, c]);
    expect(o).toMatchObject({ status: '취소상계', reviewReason: '취소 상계 (폴백 매칭)' });
    expect(c.reviewReason).toBe('취소 행 (폴백 매칭으로 상계됨)');

    const o2 = rec({ when: '2026-01-01' });
    const c2 = cancel({ when: '2026-03-05' }); // 63일
    const stats = resolve([o2, c2]);
    expect(o2.status).toBe('판정대상');
    expect(c2).toMatchObject({ status: '취소상계', reviewReason: UNPAIRED });
    expect(stats.cancelsUnpaired).toBe(1);
  });

  it('날짜 없는 취소는 기간 제한 없이 200일 떨어진 원 결제와 짝짓는다', () => {
    const o = rec({ when: '2025-06-24' });
    const c = cancel({ when: null });
    resolve([o, c]);
    expect(o.status).toBe('취소상계');
  });

  it('날짜 있는 취소는 날짜 없는 원 결제를 후보로 보지 않는다', () => {
    const o = rec({ when: null });
    const c = cancel();
    resolve([o, c]);
    expect(o.status).toBe('판정대상');
    expect(c.reviewReason).toBe(UNPAIRED);
  });

  it('후보가 둘이면 상계하지 않고 후보 모두에 needsReview 를 세운다', () => {
    const o1 = rec({ approvalNo: '1' });
    const o2 = rec({ approvalNo: '2', when: '2026-01-11' });
    const c = cancel({ approvalNo: '9' });
    const stats = resolve([o1, o2, c]);
    for (const o of [o1, o2]) {
      expect(o).toMatchObject({ status: '판정대상', needsReview: true, reviewReason: AMBIGUOUS(2) });
    }
    expect(c).toMatchObject({ status: '취소상계', reviewReason: '취소 행 (상계 대상 불확정 — 후보 2건)' });
    expect(stats).toMatchObject({ cancels: 1, cancelsPaired: 0, cancelsAmbiguous: 1, cancelsUnpaired: 0 });
  });

  it('불확정 사유는 나중에 쓴 것이 남는다', () => {
    const o1 = rec({ when: '2026-01-01' });
    const o2 = rec({ when: '2026-01-02' });
    const o3 = rec({ when: '2026-03-30' });
    const c1 = cancel({ when: '2026-01-05' }); // o1 · o2
    const c2 = cancel({ when: '2026-02-20' }); // o1 · o2 · o3
    resolve([o1, o2, o3, c1, c2]);
    for (const o of [o1, o2, o3]) expect(o.reviewReason).toBe(AMBIGUOUS(3));
  });

  it('불확정으로 표시된 원 결제도 나중에 다른 승인번호로 상계되면 표시가 풀린다', () => {
    const o1 = rec({ approvalNo: 'A1' });
    const o2 = rec({ approvalNo: 'A2' });
    const c1 = cancel({ approvalNo: 'X' });
    const c2 = cancel({ merchant: '다른상호', approvalNo: 'A1' });
    const stats = resolve([o1, o2, c1, c2]);
    expect(o1).toMatchObject({ status: '취소상계', needsReview: false, reviewReason: '취소 상계 (승인번호 매칭)' });
    expect(o2).toMatchObject({ status: '판정대상', needsReview: true, reviewReason: AMBIGUOUS(2) });
    expect(stats).toMatchObject({ cancels: 2, cancelsPaired: 1, cancelsAmbiguous: 1 });
  });

  it('원 결제 하나에 취소 둘이면 두 번째 취소는 짝이 없다', () => {
    const o1 = rec();
    const c1 = cancel();
    const c2 = cancel();
    const stats = resolve([o1, c1, c2]);
    expect(o1.status).toBe('취소상계');
    expect(c1.reviewReason).toBe('취소 행 (폴백 매칭으로 상계됨)');
    expect(c2.reviewReason).toBe(UNPAIRED);
    expect(stats).toMatchObject({ cancels: 2, cancelsPaired: 1, cancelsUnpaired: 1 });
  });

  it('승인번호가 둘 맞으면 폴백 규칙으로 넘어간다', () => {
    const o1 = rec({ merchant: '다른상호', approvalNo: 'A' });
    const o2 = rec({ approvalNo: 'A' });
    const c = cancel({ approvalNo: 'A' });
    resolve([o1, o2, c]);
    expect(o1.status).toBe('판정대상');
    expect(o2).toMatchObject({ status: '취소상계', reviewReason: '취소 상계 (폴백 매칭)' });
  });

  it('합산 행 취소는 짝을 찾지 않고, 합산 원 결제는 후보가 아니다', () => {
    const agg = rec({ merchant: '교통-카드' });
    const aggCancel = cancel({ merchant: '교통-카드' });
    const plain = rec({ merchant: '교통카드' });
    const plainCancel = cancel({ merchant: '교통카드' });
    const stats = resolve([agg, aggCancel, plain, plainCancel]);
    expect(aggCancel).toMatchObject({ status: '취소상계', reviewReason: '취소 행 (합산 행 — 개별 취소 대상이 없다)' });
    expect(agg.status).toBe('판정대상');
    expect(plain.status).toBe('취소상계');
    expect(stats).toMatchObject({ cancels: 2, cancelsPaired: 1, cancelsUnpaired: 1 });

    const lone = cancel({ merchant: '교통_카드' });
    resolve([rec({ merchant: '교통_카드' }), lone]);
    expect(lone.reviewReason).toBe('취소 행 (합산 행 — 개별 취소 대상이 없다)');
  });
});

describe('MedicalMasker', () => {
  it('처음 나온 순서로 번호를 주고, 사업자번호가 있으면 그것으로 묶는다', () => {
    const masker = new MedicalMasker();
    expect(masker.mask('가짜내과의원', '')).toBe('의료_마스킹_01');
    expect(masker.mask('가짜약국', '123-45-67890')).toBe('의료_마스킹_02');
    expect(masker.mask('가짜약국 2호점', '123-45-67890')).toBe('의료_마스킹_02');
    expect(masker.mask('가짜내과의원', '')).toBe('의료_마스킹_01');
    expect(masker.size).toBe(2);
  });
});

describe('toRows', () => {
  it('의료 행은 상호를 마스킹하고, 키도 의료_마스킹 으로 만든다', async () => {
    const records = [
    rec({ merchant: '가짜정형외과의원', amount: 15000, approvalNo: '10000002', when: '2026-01-05', memo: '메모', bizNo: '111-22-33333' }),
    rec({ merchant: '가짜온누리약국', amount: 4500, approvalNo: '10000003', when: '2026-01-06' }),
    rec({ merchant: '가짜정형외과의원', amount: 15000, approvalNo: '10000004', when: '2026-01-09', bizNo: '111-22-33333' }),
    rec({ merchant: '스타벅스코리아 서면점', amount: 11000, approvalNo: '78968731', when: '2026-01-03', memo: '회의' })];

    const stats = newStats(records.length, 0);
    const rows = await toRows(records, stats);

    expect(rows.map((r) => r.rawMerchant)).toEqual(['의료_마스킹_01', '의료_마스킹_02', '의료_마스킹_01', '스타벅스코리아 서면점']);
    expect(rows.map((r) => r.naturalKey)).toEqual(['65d6a6efc6f1a70f', 'e6594dc0766d5f4c', 'e4b9c3c3d2d5bb2a', '721607a430d35bfd']);
    expect(rows[0].naturalKey).toBe(await naturalKey('2026-01-05', '의료_마스킹', 15000, '10000002'));
    expect(rows[0].naturalKey).not.toBe(await naturalKey('2026-01-05', '가짜정형외과의원', 15000, '10000002'));
    expect(rows[0]).toMatchObject({ bizNo: '', memo: '', masked: true, approvalNo: '10000002' });
    expect(rows[3]).toMatchObject({ memo: '회의', masked: false });
    expect(stats.medicalMasked).toBe(3);
  });

  it('금액이 없으면 대상제외이고, 사유가 비어 있을 때만 금액 파싱 불가로 적는다', async () => {
    const plain = rec({ amount: null });
    const flagged = rec({ amount: null });
    flagged.status = '판정대상';
    flagged.reviewReason = '앞 단계 사유';
    const stats = newStats(2, 0);
    const rows = await toRows([plain, flagged], stats);
    expect(rows[0]).toMatchObject({ status: '대상제외', reviewReason: '금액 파싱 불가', naturalKey: '' });
    expect(rows[1]).toMatchObject({ status: '대상제외', reviewReason: '앞 단계 사유' });
    expect(stats.noAmount).toBe(2);
    expect(stats.byStatus.대상제외).toBe(2);
  });

  it('상태가 없으면 판정대상이고, 날짜가 없으면 키를 만들지 않는다', async () => {
    const stats = newStats(1, 0);
    const [row] = await toRows([rec({ when: null, installment: 3 })], stats);
    expect(row).toMatchObject({ status: '판정대상', approvedAt: '', naturalKey: '', installmentMonths: 3, isCancel: false });
    expect(stats.noDate).toBe(1);
  });

  it("합산 여부는 가리기 전 상호로 본다. '교통-카드' 는 합산이고 '교통카드' 는 아니다", async () => {
    const stats = newStats(3, 0);
    const rows = await toRows(
      [rec({ merchant: '교통-카드' }), rec({ merchant: '교통카드' }), rec({ merchant: '버스_보건소' })],
      stats
    );
    expect(rows.map((r) => r.isAggregated)).toEqual([true, false, true]);
    expect(rows[2]).toMatchObject({ rawMerchant: '의료_마스킹_01', masked: true });
    expect(stats.aggregated).toBe(2);
  });
});

describe('runPipeline', () => {
  it('레코드 순서대로 행을 내고 통계가 서로 맞는다', async () => {
    const records = [
    rec({ merchant: '정상할인', amount: -500 }),
    rec({ merchant: '가짜식당', approvalNo: '1' }),
    cancel({ merchant: '가짜식당', approvalNo: '2' }),
    rec({ merchant: '가짜구독', approvalNo: '3' }),
    rec({ merchant: '가짜구독', approvalNo: '4' }),
    cancel({ merchant: '가짜구독', approvalNo: '5' }),
    cancel({ merchant: '없는상점', approvalNo: '6' }),
    rec({ merchant: '가짜치과', amount: null, approvalNo: '7' }),
    rec({ merchant: '교통-카드', when: null })];

    const { rows, stats } = await runPipeline({
      headers: [],
      records,
      sourceRows: 10,
      foreignOnlySkipped: 1,
      declaredPeriod: null
    });

    expect(rows.map((r) => r.status)).toEqual([
    '대상제외', '취소상계', '취소상계', '판정대상', '판정대상', '취소상계', '취소상계', '대상제외', '판정대상']
    );
    expect(rows.map((r) => r.isCancel)).toEqual([false, false, true, false, false, true, true, false, false]);
    expect(stats).toMatchObject({
      sourceRows: 10,
      foreignOnlySkipped: 1,
      kept: 9,
      byStatus: { 판정대상: 3, 취소상계: 4, 대상제외: 2 },
      nonTransaction: 1,
      cancels: 3,
      cancelsPaired: 1,
      cancelsAmbiguous: 1,
      cancelsUnpaired: 1,
      noAmount: 1,
      noDate: 1,
      aggregated: 1,
      medicalMasked: 1,
      needsReview: 2
    });
    const { 판정대상, 취소상계, 대상제외 } = stats.byStatus;
    expect(판정대상 + 취소상계 + 대상제외).toBe(stats.kept);
    expect(stats.cancelsPaired + stats.cancelsAmbiguous + stats.cancelsUnpaired).toBe(stats.cancels);
    expect(rows.filter((r) => r.needsReview)).toHaveLength(stats.needsReview);
  });
});
