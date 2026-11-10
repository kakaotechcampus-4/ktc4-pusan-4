/**
 * 무작위 시연 파일의 거래 풀(src/parser/demoPool.json)을 만든다.
 *
 * 후보 거래를 KB 승인내역 파일로 만들어 실제 서버에 올리고 판정을 돌린 뒤, 나온 판정을 거래마다 적는다.
 * 미분류(분류 확인으로 가는 행)와 답변 대기(불가인데 질문이 남은 행)는 풀에 넣지 않는다 — 판정 화면이
 * 둘을 불가와 따로 세서, 풀에 넣으면 고른 건수와 화면의 건수가 달라진다.
 *
 * 실행 (frontend/ 에서, 새로 가입한 계정으로. 이전 답이 남은 계정이면 판정이 달라진다):
 *   POOL_BASE_URL=http://localhost:8080/api/v1 POOL_EMAIL=... POOL_PASSWORD=... npx vite-node scripts/build-demo-pool.ts
 *
 * 문진은 아래 CONTEXT 다. 판정 결과는 문진(직원, 자택 비율)과 날짜(주말)에 따라 달라진다.
 */
import { writeFileSync } from 'node:fs';
import { parseCardBytes } from '../src/parser';
import { buildKbDemoXls, type KbDemoRow } from '../src/parser/samples';
import type { PoolRow, PoolVerdict } from '../src/parser/randomSample';

const BASE = process.env.POOL_BASE_URL ?? 'http://localhost:8080/api/v1';
const EMAIL = process.env.POOL_EMAIL;
const PASSWORD = process.env.POOL_PASSWORD;
const OUT = new URL('../src/parser/demoPool.json', import.meta.url);

/** 문진 화면의 기본값(업종 940909, 직원 없음)에 자택 작업 없음 */
const CONTEXT = {
  industryCode: '940909',
  prevYearRevenue: 30_000_000,
  businessOpenDate: '2024-03-01',
  bookkeepingDuty: '간편장부',
  hasEmployee: false,
  homeOfficeRatio: 0
};

/**
 * 가맹점과 금액 범위. 이름은 키워드 규칙(rules/keyword_rules.yaml)에 걸리는 가짜 상호다.
 * 미분류가 되는 이름은 풀에서 빠진다. n 은 날짜와 금액을 바꿔 만들 건수다
 */
const MERCHANTS: { names: string[]; min: number; max: number; n: number; foreign?: boolean }[] = [
  // 해외SaaS · 국내SW · 광고
  { names: ['AWS', 'GITHUB, INC.', 'OPENAI *CHATGPT SUBSCR', 'FIGMA', 'NOTION LABS', 'VERCEL INC', 'CURSOR AI', 'SUPABASE', 'CLOUDFLARE', 'DIGITALOCEAN', 'SLACK TECHNOLOGIES', 'CANVA', 'ADOBE CREATIVE CLOUD', 'MICROSOFT 365', 'GOOGLE CLOUD', 'CLAUDE.AI SUBSCRIPTION', 'LINEAR ORBIT', 'HEROKU'], min: 5_000, max: 60_000, n: 3, foreign: true },
  { names: ['AWS', 'GOOGLE CLOUD', 'OPENAI *CHATGPT SUBSCR'], min: 300_000, max: 1_500_000, n: 2, foreign: true },
  { names: ['한글과컴퓨터', '이스트소프트', '네이버클라우드', 'NHN클라우드', '토스랩 잔디'], min: 9_900, max: 120_000, n: 3 },
  { names: ['GOOGLE ADS', '카카오모먼트', 'META PLATFORMS', '구글애즈'], min: 30_000, max: 300_000, n: 3 },
  // 도서 · 교육 · 사무용품 · 수리비 · 전문가수수료
  { names: ['교보문고 센텀시티점', '교보문고 부산점', '예스24', 'YES24', '알라딘', '리디북스', '밀리의서재', '알라딘 중고서점 센텀점'], min: 9_000, max: 60_000, n: 3 },
  { names: ['인프런', '패스트캠퍼스', 'UDEMY', '부산IT직업전문학원', '센텀 데이터분석학원'], min: 33_000, max: 400_000, n: 3 },
  { names: ['오피스디포 해운대점', '오피스디포 서면점', '모나미스토어', '알파문고 서면점', '알파문고 센텀점', '센텀문구'], min: 3_000, max: 90_000, n: 3 },
  { names: ['해운대컴퓨터수리', '노트북 수리센터 서면', '삼성전자서비스센터 해운대'], min: 30_000, max: 250_000, n: 3 },
  { names: ['한빛세무사사무소', '한마음법무사사무소', '특허법인 해솔', '바른노무사사무소'], min: 110_000, max: 660_000, n: 3 },
  // 금융 · 통신 · 수도광열 · 임차료 · 보험
  { names: ['국민건강보험공단', '국민연금공단'], min: 150_000, max: 250_000, n: 4 },
  { names: ['SK텔레콤', 'KT', 'LG유플러스', '헬로모바일'], min: 22_000, max: 99_000, n: 3 },
  { names: ['한국전력공사', '부산도시가스'], min: 20_000, max: 90_000, n: 3 },
  { names: ['패스트파이브 서면점', '위워크 센텀', '스파크플러스 부산'], min: 250_000, max: 600_000, n: 2 },
  { names: ['삼성화재', '현대해상'], min: 30_000, max: 150_000, n: 2 },
  // 여비교통 · 차량
  { names: ['코레일', 'SRT', '대한항공', '에어부산', '부산종합버스터미널 고속버스', '부산 택시'], min: 4_800, max: 180_000, n: 3 },
  { names: ['GS칼텍스 센텀주유소', 'SK에너지 해운대주유소', '한국도로공사 통행료', '센텀공영주차장', '쏘카'], min: 3_000, max: 90_000, n: 3 },
  // 전자기기 — 금액에 따라 소액자산 · 비품자산으로 갈린다
  { names: ['하이마트 센텀점', '전자랜드 서면점', '애플스토어', '삼성전자판매 해운대'], min: 30_000, max: 2_400_000, n: 4 },
  // 생활 · 식사 · 소비
  { names: ['쿠팡', '11번가', 'G마켓', '옥션', '무신사'], min: 9_000, max: 150_000, n: 3 },
  { names: ['배달의민족', '요기요', '쿠팡이츠'], min: 12_000, max: 45_000, n: 3 },
  { names: ['스타벅스 센텀점', '투썸플레이스 해운대점', '이디야커피 센텀점', '메가커피 서면점', '컴포즈커피 해운대점'], min: 2_000, max: 25_000, n: 3 },
  { names: ['맘스터치 해운대점', '버거킹 해운대점', '롯데리아 서면점', '교촌치킨 센텀점', '김밥천국 센텀점', '해운대 돼지국밥식당'], min: 6_000, max: 60_000, n: 3 },
  { names: ['GS25 센텀점', 'CU 해운대점', '세븐일레븐 해운대점', '이마트24 센텀점'], min: 1_500, max: 15_000, n: 3 },
  { names: ['다이소 해운대점', '홈플러스 센텀점', '노브랜드 서면점'], min: 5_000, max: 90_000, n: 3 },
  { names: ['넷플릭스', 'SPOTIFY', '유튜브프리미엄'], min: 7_900, max: 17_000, n: 3 },
  { names: ['해운대연세내과의원', '센텀온누리약국', '해운대고운피부과의원', '센텀정형외과의원', '서면밝은안과의원', '해운대365치과의원'], min: 4_000, max: 60_000, n: 4 },
  { names: ['준오헤어 센텀점', '바버샵 해운대', '블링네일 해운대점', '헤어살롱 센텀'], min: 15_000, max: 80_000, n: 4 },
  { names: ['럭키코인노래연습장', '센텀볼링장', '어벤져스PC 센텀점', '당구클럽 큐', '스포애니 피트니스', '서면 동전노래방'], min: 5_000, max: 99_000, n: 4 },
  { names: ['STEAM PURCHASE', '닌텐도 eShop', 'PLAYSTATION NETWORK', 'XBOX GAME PASS'], min: 9_000, max: 70_000, n: 4 },
  { names: ['구글플레이', '네이버페이', '카카오페이'], min: 3_000, max: 40_000, n: 3 },
  // 공과금 · 벌과금
  { names: ['해운대구 주정차위반과태료', '부산진구 주정차위반과태료', '경찰청 교통범칙금', '부산시 지방세(재산세)', '부산시 지방세(주민세)'], min: 11_000, max: 200_000, n: 3 }
];

/**
 * 2026-07-01 ~ 09-30 가운데 평일 공휴일을 뺀 날. 로컬 서버는 공휴일을 모르고(HOLIDAY_API_KEY 없음) 실서버는 알아서,
 * 공휴일 거래는 두 서버의 판정이 갈린다. 제헌절(7/17), 광복절 대체(8/17), 추석 연휴와 대체(9/24~9/28)
 */
const HOLIDAYS = new Set(['2026-07-17', '2026-08-15', '2026-08-17', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-28']);
const DAYS: string[] = [];
for (let d = new Date(Date.UTC(2026, 6, 1)); d < new Date(Date.UTC(2026, 9, 1)); d.setUTCDate(d.getUTCDate() + 1)) {
  const iso = d.toISOString().slice(0, 10);
  if (!HOLIDAYS.has(iso)) DAYS.push(iso);
}

/** 다시 돌려도 같은 후보가 나오게 시드를 고정한다 (mulberry32) */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 서버 응답에서 거래를 되찾는 키. 상호는 의료 업종이 가려져 와서 쓰지 않는다 */
const keyOf = (approvedAt: string, amount: number) => `${approvedAt}|${amount}`;

function candidates(): KbDemoRow[] {
  const random = seeded(20261110);
  const rows: KbDemoRow[] = [];
  const used = new Set<string>();
  for (const group of MERCHANTS) {
    for (const merchant of group.names) {
      for (let i = 0; i < group.n; i++) {
        const approvedAt = DAYS[Math.floor(random() * DAYS.length)];
        let amount = Math.round((group.min + random() * (group.max - group.min)) / 100) * 100;
        while (used.has(keyOf(approvedAt, amount))) amount += 100;
        used.add(keyOf(approvedAt, amount));
        rows.push({
          approvedAt,
          merchant,
          amount,
          foreign: group.foreign ? Math.round((amount / 1400) * 100) / 100 : 0,
          approvalNo: String(70_000_000 + rows.length)
        });
      }
    }
  }
  return rows;
}

let token = '';

async function call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

interface ExportItem {
  judgment: {
    transaction: { approvedAt: string; amount: number };
    verdict: { code: PoolVerdict };
    awaitingAnswer: boolean;
  };
}

async function main() {
  if (!EMAIL || !PASSWORD) throw new Error('POOL_EMAIL, POOL_PASSWORD 를 넣어 주세요');
  const rows = candidates();
  const outcome = await parseCardBytes(await buildKbDemoXls(rows));
  if (outcome.kind !== 'parsed' || !outcome.request) throw new Error('후보 파일을 읽지 못했습니다');
  if (outcome.unsendable.length > 0) throw new Error(`보내지 않는 행 ${outcome.unsendable.length}건`);

  token = (await call<{ accessToken: string }>('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).accessToken;
  const context = await call<{ id: string }>('POST', '/users/me/contexts', CONTEXT);
  const batch = await call<{ id: string; transactionCount: number; classificationPendingCount: number }>(
    'POST', '/upload-batches', outcome.request, { 'Idempotency-Key': crypto.randomUUID() });
  console.log(`후보 ${rows.length}건, 올라간 거래 ${batch.transactionCount}건, 미분류 ${batch.classificationPendingCount}건`);

  const run = await call<{ id: string }>('POST', '/judgment-runs', { batchId: batch.id, contextId: context.id });
  for (;;) {
    const status = (await call<{ status: { code: string } }>('GET', `/judgment-runs/${run.id}`)).status.code;
    if (status === 'COMPLETED') break;
    if (status === 'FAILED' || status === 'PARTIAL_FAILED') throw new Error(`판정 실행 ${status}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const { items } = await call<{ items: ExportItem[] }>('GET', `/judgments/export?batchId=${batch.id}`);
  const verdictOf = new Map(items.map(({ judgment: j }) => [keyOf(j.transaction.approvedAt, j.transaction.amount), j]));
  const pool: PoolRow[] = [];
  let awaiting = 0;
  for (const row of rows) {
    const judgment = verdictOf.get(keyOf(row.approvedAt, row.amount));
    if (!judgment) continue;
    if (judgment.awaitingAnswer) {
      awaiting += 1;
      continue;
    }
    pool.push({
      approvedAt: row.approvedAt,
      merchant: row.merchant,
      amount: row.amount,
      foreign: row.foreign,
      verdict: judgment.verdict.code
    });
  }
  pool.sort((a, b) => a.approvedAt.localeCompare(b.approvedAt) || a.amount - b.amount);
  writeFileSync(OUT, `${JSON.stringify(pool, null, 1)}\n`);

  const count = (verdict: PoolVerdict) => pool.filter((row) => row.verdict === verdict).length;
  console.log(`판정 ${items.length}건 중 답변 대기 ${awaiting}건을 빼고 풀 ${pool.length}건:`,
    `가능 ${count('AVAILABLE')}, 확인필요 ${count('NEEDS_REVIEW')}, 불가 ${count('UNAVAILABLE')}`);
}

await main();
