import POOL_JSON from './demoPool.json';
import { buildKbDemoXls, type KbDemoRow } from './samples';

/**
 * 시연용 무작위 KB 승인내역 파일. 판정이 정해진 거래 풀(demoPool.json)에서 판정별 건수만큼 골라 만든다.
 * 풀은 scripts/build-demo-pool.ts 가 실제 서버에서 판정을 돌려 만든다. 문진은 업종 940909, 직원 없음,
 * 자택 작업 없음이고, 처음 올리는 계정 기준이다 — 앞서 답한 질문이 있으면 그 가맹점의 판정이 바뀐다.
 */

export type PoolVerdict = 'AVAILABLE' | 'NEEDS_REVIEW' | 'UNAVAILABLE';

export interface PoolRow {
  approvedAt: string;
  merchant: string;
  amount: number;
  foreign: number;
  verdict: PoolVerdict;
}

export type VerdictCounts = Record<PoolVerdict, number>;

const POOL = POOL_JSON as PoolRow[];

/** 무작위 파일의 거래 건수 범위 */
export const RANDOM_ROWS = { min: 100, max: 300 };

/** 거래 건수를 RANDOM_ROWS 안에서 고른다 */
export function randomTotal(random: () => number = Math.random): number {
  return RANDOM_ROWS.min + Math.floor(random() * (RANDOM_ROWS.max - RANDOM_ROWS.min + 1));
}

/** 확인필요는 전체의 이 몫을 넘지 않는다. 시연에서 판정을 못 한 것처럼 보이지 않게 한다 */
export const MAX_REVIEW_SHARE = 0.1;

/** 확인필요를 뺀 나머지 가운데 가능의 몫. 이 범위에서 고른다 */
const AVAILABLE_SHARE = { min: 0.5, max: 0.8 };

/**
 * 건수를 판정별로 무작위로 나눈다. 확인필요는 1건부터 전체의 10%까지(10건 미만이면 0건),
 * 나머지는 가능 50~80%, 불가가 그 나머지다
 */
export function randomCounts(total: number, random: () => number = Math.random): VerdictCounts {
  const maxReview = Math.floor(total * MAX_REVIEW_SHARE);
  const review = maxReview === 0 ? 0 : 1 + Math.floor(random() * maxReview);
  const rest = total - review;
  const share = AVAILABLE_SHARE.min + random() * (AVAILABLE_SHARE.max - AVAILABLE_SHARE.min);
  const available = Math.round(rest * share);
  return { AVAILABLE: available, NEEDS_REVIEW: review, UNAVAILABLE: rest - available };
}

/** 겹치지 않게 n 개를 고른다. 풀보다 많이 달라면 한 바퀴를 다 쓴 뒤 다시 섞어 고른다 */
function sample<T>(items: T[], n: number, random: () => number): T[] {
  const picked: T[] = [];
  while (picked.length < n) {
    const deck = [...items];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    picked.push(...deck.slice(0, n - picked.length));
  }
  return picked;
}

/** 판정별 건수만큼 풀에서 고른 행. 승인번호는 새로 만들어 같은 계정에 여러 번 올려도 중복으로 걸리지 않는다 */
export function pickRows(counts: VerdictCounts, random: () => number = Math.random, pool: PoolRow[] = POOL): KbDemoRow[] {
  const approvalNos = new Set<string>();
  const rows: KbDemoRow[] = [];
  for (const verdict of Object.keys(counts) as PoolVerdict[]) {
    const n = counts[verdict];
    if (n === 0) continue;
    const candidates = pool.filter((row) => row.verdict === verdict);
    if (candidates.length === 0) throw new Error(`풀에 ${verdict} 거래가 없습니다`);
    for (const row of sample(candidates, n, random)) {
      let approvalNo: string;
      do {
        approvalNo = String(10_000_000 + Math.floor(random() * 90_000_000));
      } while (approvalNos.has(approvalNo));
      approvalNos.add(approvalNo);
      rows.push({ approvedAt: row.approvedAt, merchant: row.merchant, amount: row.amount, foreign: row.foreign, approvalNo });
    }
  }
  // 실제 승인내역처럼 최근 거래가 위에 온다
  return rows.sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
}

/**
 * 판정별 건수대로 만든 KB 승인내역 파일. 이름은 거래내역_UUID 다 — 시연에서 건수가 미리 보이지 않게 하고,
 * 여러 번 만들어도 이름이 겹치지 않게 한다
 */
export async function buildRandomSample(counts: VerdictCounts, random: () => number = Math.random): Promise<File> {
  const bytes = await buildKbDemoXls(pickRows(counts, random));
  return new File([bytes], `거래내역_${crypto.randomUUID()}.xls`, { type: 'application/vnd.ms-excel' });
}

/** 업로드 화면의 「무작위 카드내역 만들기」. 건수(100~300)와 판정별 몫을 모두 무작위로 정한다 */
export function buildRandomUpload(random: () => number = Math.random): Promise<File> {
  return buildRandomSample(randomCounts(randomTotal(random), random), random);
}
