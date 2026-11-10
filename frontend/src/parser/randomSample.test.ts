import { describe, expect, it } from 'vitest';
import POOL_JSON from './demoPool.json';
import { parseCardFile } from '.';
import {
  MAX_REVIEW_SHARE,
  RANDOM_ROWS,
  buildRandomSample,
  buildRandomUpload,
  pickRows,
  randomCounts,
  randomTotal,
  type PoolRow,
  type VerdictCounts
} from './randomSample';

/** 같은 수가 나오는 난수. 실패를 다시 볼 수 있게 시드를 고정한다 */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POOL = POOL_JSON as PoolRow[];
const verdictOf = new Map(POOL.map((row) => [`${row.approvedAt}|${row.merchant}|${row.amount}`, row.verdict]));

describe('randomTotal', () => {
  it('100건부터 300건 사이에서 고르고 양 끝도 나온다', () => {
    const random = seeded(7);
    const totals = Array.from({ length: 5000 }, () => randomTotal(random));
    expect(Math.min(...totals)).toBe(RANDOM_ROWS.min);
    expect(Math.max(...totals)).toBe(RANDOM_ROWS.max);
    expect(totals.every(Number.isInteger)).toBe(true);
  });
});

describe('randomCounts', () => {
  it('건수를 다 나누고, 확인필요는 1건부터 전체의 10%까지다', () => {
    const random = seeded(1);
    for (const total of [10, 11, 25, 50, 99, 200, 300]) {
      for (let i = 0; i < 200; i++) {
        const counts = randomCounts(total, random);
        expect(counts.AVAILABLE + counts.NEEDS_REVIEW + counts.UNAVAILABLE).toBe(total);
        expect(counts.NEEDS_REVIEW).toBeGreaterThanOrEqual(1);
        expect(counts.NEEDS_REVIEW).toBeLessThanOrEqual(total * MAX_REVIEW_SHARE);
        expect(counts.UNAVAILABLE).toBeGreaterThan(0);
      }
    }
  });

  it('10건 미만이면 확인필요를 넣지 않는다', () => {
    expect(randomCounts(9, seeded(2)).NEEDS_REVIEW).toBe(0);
  });

  it('부를 때마다 나누는 몫이 달라진다', () => {
    const random = seeded(3);
    const seen = new Set(Array.from({ length: 20 }, () => JSON.stringify(randomCounts(50, random))));
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe('pickRows', () => {
  it('판정별 건수만큼 풀에서 고르고 승인번호는 겹치지 않는다', () => {
    // 불가는 풀보다 많이 달라 한 바퀴를 넘긴다
    const counts: VerdictCounts = { AVAILABLE: 120, NEEDS_REVIEW: 15, UNAVAILABLE: 150 };
    const rows = pickRows(counts, seeded(4));
    expect(rows).toHaveLength(285);
    const tally = { AVAILABLE: 0, NEEDS_REVIEW: 0, UNAVAILABLE: 0 };
    for (const row of rows) {
      const verdict = verdictOf.get(`${row.approvedAt}|${row.merchant}|${row.amount}`);
      if (verdict) tally[verdict] += 1;
    }
    expect(tally).toEqual(counts);
    expect(new Set(rows.map((row) => row.approvalNo)).size).toBe(rows.length);
  });

  it('풀에 없는 판정을 달라면 알린다', () => {
    expect(() => pickRows({ AVAILABLE: 0, NEEDS_REVIEW: 1, UNAVAILABLE: 0 }, seeded(5), [])).toThrow();
  });
});

describe('buildRandomSample', () => {
  it('파서가 고른 건수 그대로 판정대상으로 읽는다', async () => {
    const counts: VerdictCounts = { AVAILABLE: 30, NEEDS_REVIEW: 4, UNAVAILABLE: 16 };
    const file = await buildRandomSample(counts, seeded(6));
    expect(file.name).toMatch(/^거래내역_[0-9a-f-]{36}\.xls$/);
    const outcome = await parseCardFile(file);
    if (outcome.kind !== 'parsed') throw new Error(outcome.kind);
    expect(outcome.issuer).toBe('kb');
    expect(outcome.unsendable).toEqual([]);
    expect(outcome.request?.transactions).toHaveLength(50);
    expect(outcome.request?.transactions.every((t) => t.status === 'JUDGEABLE')).toBe(true);
  });
});

describe('buildRandomUpload', () => {
  it('100~300건짜리 파일을 만들고, 만들 때마다 이름이 다르다', async () => {
    const random = seeded(8);
    const [first, second] = [await buildRandomUpload(random), await buildRandomUpload(random)];
    expect(first.name).not.toBe(second.name);
    const outcome = await parseCardFile(first);
    if (outcome.kind !== 'parsed') throw new Error(outcome.kind);
    const sent = outcome.request?.transactions.length ?? 0;
    expect(sent).toBeGreaterThanOrEqual(RANDOM_ROWS.min);
    expect(sent).toBeLessThanOrEqual(RANDOM_ROWS.max);
  });
});
