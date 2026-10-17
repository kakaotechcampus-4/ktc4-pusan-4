import { naturalKey } from './hash';
import {
  AGGREGATED_RE,
  MEDICAL_PREFIX,
  MEDICAL_RE,
  NON_TRANSACTION_RE,
  PAIR_WINDOW_DAYS,
  ST_EXCLUDED,
  ST_OFFSET,
  ST_TARGET,
  dayNumber } from
'./primitives';
import type { AdapterResult, ParseStats, ParsedRow, RawRecord } from './types';

/**
 * 읽은 레코드의 공통 후처리. tools/parsers/__init__.py 의 순서를 그대로 따른다:
 * 비거래 표시 → 취소 상계 → 행 변환. 레코드는 지우지 않고 status · needsReview ·
 * reviewReason 만 제자리에서 고친다.
 */

export function newStats(sourceRows: number, foreignOnlySkipped: number): ParseStats {
  return {
    sourceRows,
    foreignOnlySkipped,
    kept: 0,
    byStatus: { 판정대상: 0, 취소상계: 0, 대상제외: 0 },
    nonTransaction: 0,
    cancels: 0,
    cancelsPaired: 0,
    cancelsAmbiguous: 0,
    cancelsUnpaired: 0,
    noAmount: 0,
    noDate: 0,
    aggregated: 0,
    medicalMasked: 0,
    needsReview: 0
  };
}

/**
 * 할인 · 포인트사용 행에 대상제외를 붙인다. 버리지 않는다.
 * IBK 는 승인구분을 '취소또는할인' 한 칸에 묶어 주므로, 먼저 갈라놓지 않으면
 * 할인 행이 전부 '짝을 못 찾은 취소' 로 쌓인다.
 */
export function markNonTransactions(records: RawRecord[], stats: ParseStats): RawRecord[] {
  for (const r of records) {
    if (NON_TRANSACTION_RE.test(r.merchant) && !r.bizNo) {
      stats.nonTransaction += 1;
      r.status = ST_EXCLUDED;
      r.reviewReason = '비거래 항목 (카드사 정산 행)';
    }
  }
  return records;
}

/**
 * 취소 행과 그 원 결제에 취소상계를 붙인다. 행은 지우지 않는다.
 * 틀린 짝을 상계하면 경비가 줄어 세금을 더 내므로, 짝이 하나로 정해질 때만 상계하고
 * 후보가 여럿이면 후보 전체에 needsReview 를 세워 사용자에게 넘긴다.
 *
 * 1순위: 승인번호가 정확히 하나 일치. 2순위(폴백): 같은 상호 + 같은 절대금액 +
 * PAIR_WINDOW_DAYS 이내. 날짜 없는 취소에는 기간 제한을 걸지 않는다.
 */
export function resolveCancellations(records: RawRecord[], stats: ParseStats): RawRecord[] {
  const live = records.filter((r) => r.status !== ST_EXCLUDED);
  const originals = live.filter((r) => !r.isCancel);
  const cancels = live.filter((r) => r.isCancel);
  const used = new Set<RawRecord>();
  const flagged = new Map<RawRecord, string>();

  // 합산 행은 여러 건을 묶은 한 줄이라 개별 취소 대상이 될 수 없다
  const pairable = originals.filter((o) => !AGGREGATED_RE.test(o.merchant));

  for (const c of cancels) {
    stats.cancels += 1;
    c.status = ST_OFFSET;

    if (AGGREGATED_RE.test(c.merchant)) {
      stats.cancelsUnpaired += 1;
      c.reviewReason = '취소 행 (합산 행 — 개별 취소 대상이 없다)';
      continue;
    }

    let mate: RawRecord | null = null;
    let how = '';
    if (c.approvalNo) {
      const hits = pairable.filter((o) => !used.has(o) && o.approvalNo === c.approvalNo);
      if (hits.length === 1) {
        mate = hits[0];
        how = '승인번호';
      }
    }

    let cands: RawRecord[] = [];
    if (mate === null) {
      const cancelAmount = c.amount;
      cands = pairable.filter((o) =>
      !used.has(o) &&
      o.merchant === c.merchant &&
      o.amount !== null && cancelAmount !== null &&
      Math.abs(o.amount) === Math.abs(cancelAmount)
      );
      const cancelWhen = c.when;
      if (cancelWhen !== null) {
        const cancelDay = dayNumber(cancelWhen);
        cands = cands.filter((o) =>
        o.when !== null && Math.abs(cancelDay - dayNumber(o.when)) <= PAIR_WINDOW_DAYS
        );
      }
      if (cands.length === 1) {
        mate = cands[0];
        how = '폴백';
      }
    }

    if (mate !== null) {
      used.add(mate);
      stats.cancelsPaired += 1;
      mate.status = ST_OFFSET;
      mate.reviewReason = `취소 상계 (${how} 매칭)`;
      c.reviewReason = `취소 행 (${how} 매칭으로 상계됨)`;
    } else if (cands.length >= 2) {
      stats.cancelsAmbiguous += 1;
      c.reviewReason = `취소 행 (상계 대상 불확정 — 후보 ${cands.length}건)`;
      for (const o of cands) {
        flagged.set(o,
        `취소 대상 불확정 — 같은 상호·금액 결제가 ${cands.length}건이라 어느 건이 취소됐는지 자동 판정 불가`
        );
      }
    } else {
      stats.cancelsUnpaired += 1;
      c.reviewReason = '취소 행 (짝 후보 없음 — 원 결제가 조회 기간 밖일 수 있다)';
    }
  }

  for (const o of originals) {
    if (o.status) continue;
    o.status = ST_TARGET;
    const reason = flagged.get(o);
    if (reason !== undefined) {
      o.needsReview = true;
      o.reviewReason = reason;
    }
  }
  return records;
}

/**
 * 의료 업종 상호 마스킹. 한 업로드 안에서 처음 나온 순서대로 의료_마스킹_01, _02 … 를 붙인다.
 * 사업자번호가 있으면 그것으로, 없으면 상호로 같은 곳을 묶는다.
 */
export class MedicalMasker {
  private readonly labels = new Map<string, string>();

  mask(merchant: string, bizNo: string): string {
    const key = bizNo || merchant;
    let label = this.labels.get(key);
    if (label === undefined) {
      label = `${MEDICAL_PREFIX}_${String(this.labels.size + 1).padStart(2, '0')}`;
      this.labels.set(key, label);
    }
    return label;
  }

  get size(): number {
    return this.labels.size;
  }
}

/** 출력 행으로 바꾼다. 레코드 순서를 지킨다 */
export async function toRows(records: RawRecord[], stats: ParseStats): Promise<ParsedRow[]> {
  const masker = new MedicalMasker();
  const rows: ParsedRow[] = [];
  const keys: Promise<string>[] = [];

  // 마스킹 번호가 처음 나온 순서를 따르도록 레코드를 동기로 먼저 한 번 훑는다
  for (const r of records) {
    let status = r.status ?? ST_TARGET;
    let reason = r.reviewReason;
    if (r.amount === null) {
      // 금액을 못 읽은 행도 버리지 않는다. 왜 빠졌는지 남아야 한다
      stats.noAmount += 1;
      status = ST_EXCLUDED;
      reason = reason || '금액 파싱 불가';
    }

    const isAggregated = AGGREGATED_RE.test(r.merchant);
    if (isAggregated) stats.aggregated += 1;

    let rawMerchant = r.merchant;
    let bizNo = r.bizNo;
    let memo = r.memo;
    const masked = MEDICAL_RE.test(r.merchant);
    if (masked) {
      rawMerchant = masker.mask(r.merchant, r.bizNo);
      bizNo = ''; // 사업자번호가 남으면 어느 병원인지 역추적된다
      memo = '';
      stats.medicalMasked += 1;
    }

    const approvedAt = r.when ?? '';
    if (!approvedAt) stats.noDate += 1;

    // 마스킹한 행은 원래 상호 대신 고정 문자열 의료_마스킹 으로 키를 만든다 (hash.ts naturalKey 참고)
    keys.push(naturalKey(approvedAt, masked ? MEDICAL_PREFIX : r.merchant, r.amount, r.approvalNo));

    stats.kept += 1;
    stats.byStatus[status] += 1;
    if (r.needsReview) stats.needsReview += 1;
    rows.push({
      approvedAt,
      rawMerchant,
      amount: r.amount,
      installmentMonths: r.installment,
      approvalNo: r.approvalNo,
      naturalKey: '',
      bizNo,
      memo,
      sourceCard: r.source,
      status,
      isAggregated,
      needsReview: r.needsReview,
      reviewReason: reason,
      isCancel: r.isCancel,
      masked
    });
  }

  const resolved = await Promise.all(keys);
  rows.forEach((row, i) => {
    row.naturalKey = resolved[i];
  });
  return rows;
}

export async function runPipeline(adapter: AdapterResult): Promise<{rows: ParsedRow[];stats: ParseStats;}> {
  const stats = newStats(adapter.sourceRows, adapter.foreignOnlySkipped);
  const records = resolveCancellations(markNonTransactions(adapter.records, stats), stats);
  const rows = await toRows(records, stats);
  return { rows, stats };
}
