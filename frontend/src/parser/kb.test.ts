import { describe, expect, it } from 'vitest';
import { classifyStatement } from './detect';
import { gridFromSheet, kbDeclaredPeriod, kbRecords, loadXlsx, readKb } from './kb';
import { ParserError } from './primitives';
import { buildKbXls } from './samples';
import type { Cell, Grid } from './types';

const gridOf = (rows: Cell[][]): Grid => ({
  nrows: rows.length,
  ncols: Math.max(0, ...rows.map((row) => row.length)),
  cell: (r, c) => rows[r]?.[c]
});

/** 0~5행 요약 + 6행 헤더 다음에 rows 를 둔 시트 */
async function kbBytes(rows: Cell[][]): Promise<ArrayBuffer> {
  const xlsx = await loadXlsx();
  const book = xlsx.utils.book_new();
  const aoa = [[], ['조회기간', '2026-01-01 ~ 2026-01-31'], [], [], [], [], ['이용일', '이용하신곳'], ...rows];
  xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet(aoa), 'Sheet1');
  return xlsx.write(book, { bookType: 'biff8', type: 'array' }) as ArrayBuffer;
}

describe('readKb — 샘플 full', () => {
  it('6행 헤더를 절대 주소로 읽는다. 0행 · 5행이 비어 있어도 밀리지 않는다', async () => {
    const { headers } = await readKb(await buildKbXls('full'));
    expect(headers).toHaveLength(15);
    expect(headers[0]).toBe('이용일');
    expect(headers[4]).toBe('이용하신곳');
    expect(headers[5]).toBe('국내이용금액\n(원)');
    expect(headers[13]).toBe('승인번호');
    expect(headers[14]).toBe('');
    expect(classifyStatement(headers)).toEqual({
      kind: '승인내역',
      code: 'APPROVAL',
      why: '가맹점명(이용하신곳) + 승인정보(승인번호)'
    });
  });

  it('행 수와 건너뛴 행을 센다', async () => {
    const result = await readKb(await buildKbXls('full'));
    expect(result.sourceRows).toBe(14);
    expect(result.foreignOnlySkipped).toBe(1);
    expect(result.records).toHaveLength(13);
    expect(result.declaredPeriod).toEqual({ start: '2026-01-01', end: '2026-03-31' });
    expect(result.records.map((r) => r.merchant)).toEqual([
      '스타벅스코리아 서면점', '서면연세의원', '부산약국', '서면연세의원', '쿠팡', '쿠팡', '교보문고', '하이마트',
      '지하철_모바일 50 건', 'GS25 서면점', '포인트사용', '다이소 서면점', '넷플릭스']);
  });

  it('행마다 값을 옮긴다', async () => {
    const { records } = await readKb(await buildKbXls('full'));
    const byApproval = (no: string) => records.find((r) => r.approvalNo === no);
    expect(records[0]).toEqual({
      merchant: '스타벅스코리아 서면점',
      amount: 11000,
      bizNo: '',
      memo: 'Onedrive',
      source: 'kb',
      approvalNo: '78968731',
      when: '2026-01-03',
      isCancel: false,
      installment: 0,
      status: null,
      needsReview: false,
      reviewReason: ''
    });
    expect(byApproval('10000002')).toMatchObject({ memo: '진료', amount: 15000, when: '2026-01-05' });
    expect(byApproval('10000003')).toMatchObject({ installment: 0, amount: 4500 });
    expect(byApproval('20000008')).toMatchObject({ isCancel: false, amount: 39000 });
    expect(byApproval('20000009')).toMatchObject({ isCancel: true, amount: -39000, when: '2026-01-12' });
    expect(byApproval('30000001')).toMatchObject({ merchant: '교보문고', amount: 22000, when: '2026-01-15' });
    expect(byApproval('30000002')).toMatchObject({ installment: 3 });
    // 날짜가 숫자 셀(엑셀 일련번호)이면 읽지 않는다
    expect(byApproval('30000004')).toMatchObject({ when: null, amount: 3000 });
    expect(byApproval('30000005')).toMatchObject({ amount: -1000 });
    // 국내 · 해외 금액이 모두 0 이면 금액이 없다
    expect(byApproval('30000006')).toMatchObject({ amount: null });
    expect(byApproval('30000008')).toMatchObject({ when: '2026-03-31', memo: 'GPT' });
  });
});

describe('readKb — 샘플 변형', () => {
  it('noSummary 는 조회기간이 없고 거래는 같다', async () => {
    const full = await readKb(await buildKbXls('full'));
    const result = await readKb(await buildKbXls('noSummary'));
    expect(result.declaredPeriod).toBeNull();
    expect(result.headers).toEqual(full.headers);
    expect(result.records).toEqual(full.records);
    expect(result.sourceRows).toBe(14);
  });

  it('billing 은 청구내역으로 판별된다', async () => {
    const { headers } = await readKb(await buildKbXls('billing'));
    expect(classifyStatement(headers)).toEqual({
      kind: '청구내역',
      code: 'BILLING',
      why: '청구 컬럼(청구금액, 청구일, 청구원금) 있고 가맹점명 없음'
    });
  });

  it('empty 는 헤더가 없어 판별불가다', async () => {
    const result = await readKb(await buildKbXls('empty'));
    expect(result.headers).toEqual([]);
    expect(result.records).toEqual([]);
    const verdict = classifyStatement(result.headers);
    expect(verdict.code).toBe('NO_COLUMNS');
    expect(verdict.why.endsWith('(헤더: 없음)')).toBe(true);
  });
});

describe('readKb — 셀 값', () => {
  it('숫자로 저장된 승인번호는 정수 문자열이다', async () => {
    const row: Cell[] = ['2026-01-03', '', '', '', '교보문고', 22000, 0, '일시불', '', 0, 0, '전표매입', '', 30000001];
    const { records } = await readKb(await kbBytes([row]));
    expect(records[0].approvalNo).toBe('30000001');
  });

  it('메모 칸이 없는 행도 읽는다', async () => {
    const { records } = await readKb(await kbBytes([['2026-01-03', '', '', '', '쿠팡', 1000]]));
    expect(records[0]).toMatchObject({ merchant: '쿠팡', amount: 1000, memo: '', approvalNo: '', when: '2026-01-03' });
  });
});

describe('readKb — 읽지 못하는 파일', () => {
  const kbReadError = async (bytes: ArrayBuffer) => {
    const error = await readKb(bytes).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ParserError);
    expect((error as ParserError).code).toBe('KB_READ');
  };

  it('HTML 은 KB 로 읽지 않는다', async () => {
    await kbReadError(new TextEncoder().encode('<html><table><tr><td>1</td></tr></table></html>').buffer as ArrayBuffer);
  });

  it('OLE 머리만 있고 내용이 깨진 파일', async () => {
    const bytes = new Uint8Array(1024);
    bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    await kbReadError(bytes.buffer);
  });
});

describe('gridFromSheet', () => {
  it('크기는 !ref 가 아니라 셀 주소에서 잡고, 값은 .v 만 읽는다', async () => {
    const xlsx = await loadXlsx();
    const grid = gridFromSheet(xlsx, {
      '!ref': 'A1:B2',
      A1: { t: 's', v: '조회기간' },
      C5: { t: 'n', v: 46040, w: '2026-01-18' }
    });
    expect(grid.nrows).toBe(5);
    expect(grid.ncols).toBe(3);
    expect(grid.cell(4, 2)).toBe(46040);
    expect(grid.cell(0, 0)).toBe('조회기간');
    expect(grid.cell(1, 1)).toBeUndefined();
  });
});

describe('kbDeclaredPeriod', () => {
  it('조회기간 오른쪽의 첫 값 있는 칸을 읽는다', () => {
    expect(kbDeclaredPeriod(gridOf([[], [' 조회 기간 ', '', '2026.1.1 ~ 2026.3.31']]))).toEqual({
      start: '2026-01-01',
      end: '2026-03-31'
    });
  });

  it('형식이 맞지 않거나 6행 이후에 있으면 null 이다', () => {
    expect(kbDeclaredPeriod(gridOf([['조회기간', '2026-01-01']]))).toBeNull();
    expect(kbDeclaredPeriod(gridOf([['조회기간', '2026-02-30 ~ 2026-03-31']]))).toBeNull();
    expect(kbDeclaredPeriod(gridOf([['조회기간']]))).toBeNull();
    const late: Cell[][] = [[], [], [], [], [], [], ['조회기간', '2026-01-01 ~ 2026-03-31']];
    expect(kbDeclaredPeriod(gridOf(late))).toBeNull();
  });
});

describe('kbRecords', () => {
  const header: Cell[][] = [[], [], [], [], [], [], []];

  it('가맹점명이 비면 세지 않고, 외화만 있으면 세고 건너뛴다', () => {
    const result = kbRecords(gridOf([
      ...header,
      ['2026-01-03', '', '', '', '  ', 1000],
      ['2026-01-03', '', '', '', 'AWS', 0, 12.5],
      ['2026-01-03', '', '', '', '다이소', 0, 0]]));
    expect(result.sourceRows).toBe(2);
    expect(result.foreignOnlySkipped).toBe(1);
    expect(result.records.map((r) => [r.merchant, r.amount])).toEqual([['다이소', null]]);
  });
});
