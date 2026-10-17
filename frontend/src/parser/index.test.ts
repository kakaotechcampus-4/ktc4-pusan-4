// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from './hash';
import { parseCardBytes } from './index';
import { buildIbkHtml, buildKbXls } from './samples';
import { serverValidate } from './serverValidate.testutil';

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

const utf8 = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe('parseCardBytes — KB 샘플', () => {
  it('full: 선언 기간 · 마스킹 · 취소 상계 · 보내지 않는 행까지 한 번에 만든다', async () => {
    const bytes = await buildKbXls('full');
    const outcome = await parseCardBytes(bytes);
    expect(outcome.kind).toBe('parsed');
    if (outcome.kind !== 'parsed') return;

    expect(outcome.issuer).toBe('kb');
    expect(outcome.stats).toEqual({
      sourceRows: 14,
      foreignOnlySkipped: 1,
      kept: 13,
      byStatus: { 판정대상: 9, 취소상계: 2, 대상제외: 2 },
      nonTransaction: 1,
      cancels: 1,
      cancelsPaired: 1,
      cancelsAmbiguous: 0,
      cancelsUnpaired: 0,
      noAmount: 1,
      noDate: 1,
      aggregated: 1,
      medicalMasked: 3,
      needsReview: 0
    });

    const byApproval = (no: string) => outcome.rows.find((r) => r.approvalNo === no);
    expect(byApproval('78968731')).toMatchObject({
      rawMerchant: '스타벅스코리아 서면점',
      naturalKey: '721607a430d35bfd',
      memo: 'Onedrive'
    });
    expect(byApproval('10000002')).toMatchObject({
      rawMerchant: '의료_마스킹_01',
      naturalKey: '65d6a6efc6f1a70f',
      memo: '',
      masked: true
    });
    expect(byApproval('10000003')).toMatchObject({
      rawMerchant: '의료_마스킹_02',
      naturalKey: 'e6594dc0766d5f4c',
      masked: true
    });
    expect(byApproval('10000004')).toMatchObject({
      rawMerchant: '의료_마스킹_01',
      naturalKey: 'e4b9c3c3d2d5bb2a',
      masked: true
    });
    expect(byApproval('20000008')).toMatchObject({
      status: '취소상계',
      reviewReason: '취소 상계 (폴백 매칭)'
    });
    expect(byApproval('20000009')).toMatchObject({
      status: '취소상계',
      amount: -39000,
      naturalKey: 'b9119080c84cc753',
      reviewReason: '취소 행 (폴백 매칭으로 상계됨)'
    });
    expect(byApproval('30000001')).toMatchObject({
      rawMerchant: '교보문고',
      naturalKey: '482cff86a4762645'
    });
    expect(byApproval('30000002')?.installmentMonths).toBe(3);
    expect(byApproval('30000003')?.isAggregated).toBe(true);
    expect(byApproval('30000005')).toMatchObject({
      status: '대상제외',
      reviewReason: '비거래 항목 (카드사 정산 행)'
    });
    expect(byApproval('30000006')).toMatchObject({
      status: '대상제외',
      reviewReason: '금액 파싱 불가'
    });

    expect(outcome.unsendable.map((u) => [u.code, u.row.approvalNo])).toEqual([
      ['NO_DATE', '30000004'],
      ['NO_AMOUNT', '30000006']
    ]);

    expect(outcome.request).not.toBeNull();
    if (!outcome.request) return;
    expect(outcome.request.cardIssuer).toBe('국민');
    expect(outcome.request.periodStart).toBe('2026-01-01');
    expect(outcome.request.periodEnd).toBe('2026-03-31');
    expect(outcome.request.fileHash).toBe(`sha256:${await sha256Hex(bytes)}`);
    expect(outcome.request.transactions).toHaveLength(11);
    expect(outcome.request.transactions.find((t) => t.approvalNo === '20000009')?.amount).toBe(-39000);
    expect(serverValidate(outcome.request)).toEqual([]);
  });

  it('noSummary: 선언 기간이 없으면 보내는 거래의 최소·최대 승인일을 쓴다', async () => {
    const outcome = await parseCardBytes(await buildKbXls('noSummary'));
    expect(outcome.kind).toBe('parsed');
    if (outcome.kind !== 'parsed') return;
    expect(outcome.request?.periodStart).toBe('2026-01-03');
    expect(outcome.request?.periodEnd).toBe('2026-03-31');
  });

  it('billing · empty 는 차단 결과를 돌려준다', async () => {
    const billing = await parseCardBytes(await buildKbXls('billing'));
    expect(billing).toEqual({
      kind: 'blocked',
      statement: '청구내역',
      code: 'BILLING',
      why: '청구 컬럼(청구금액, 청구일, 청구원금) 있고 가맹점명 없음',
      detected: 'kb'
    });

    const empty = await parseCardBytes(await buildKbXls('empty'));
    expect(empty).toMatchObject({
      kind: 'blocked',
      statement: '판별불가',
      code: 'NO_COLUMNS',
      detected: 'kb'
    });
    if (empty.kind === 'blocked') {
      expect(empty.why.endsWith('(헤더: 없음)')).toBe(true);
    }
  });
});

describe('parseCardBytes — IBK 샘플', () => {
  it('full: 22행을 후처리하고 보내는 19행으로 요청을 만든다', async () => {
    const bytes = utf8(buildIbkHtml('full'));
    const outcome = await parseCardBytes(bytes);
    expect(outcome.kind).toBe('parsed');
    if (outcome.kind !== 'parsed') return;

    expect(outcome.issuer).toBe('ibk');
    expect(outcome.stats).toEqual({
      sourceRows: 22,
      foreignOnlySkipped: 0,
      kept: 22,
      byStatus: { 판정대상: 11, 취소상계: 9, 대상제외: 2 },
      nonTransaction: 1,
      cancels: 7,
      cancelsPaired: 2,
      cancelsAmbiguous: 1,
      cancelsUnpaired: 4,
      noAmount: 1,
      noDate: 1,
      aggregated: 2,
      medicalMasked: 2,
      needsReview: 2
    });

    expect(outcome.rows[0]).toMatchObject({
      rawMerchant: '스타벅스코리아 서면점',
      naturalKey: '721607a430d35bfd'
    });
    expect(outcome.rows[16]).toMatchObject({ rawMerchant: '의료_마스킹_01', bizNo: '', masked: true });
    expect(outcome.rows[17]).toMatchObject({ rawMerchant: '의료_마스킹_01', bizNo: '', masked: true });

    expect(outcome.unsendable.map((u) => [u.index, u.code])).toEqual([
      [18, 'NO_DATE'],
      [19, 'BLANK_MERCHANT'],
      [20, 'NO_AMOUNT']
    ]);

    expect(outcome.request).not.toBeNull();
    if (!outcome.request) return;
    expect(outcome.request.cardIssuer).toBe('기업');
    expect(outcome.request.periodStart).toBe('2026-01-01');
    expect(outcome.request.periodEnd).toBe('2026-03-05');
    expect(outcome.request.transactions).toHaveLength(19);
    expect(serverValidate(outcome.request)).toEqual([]);
  });

  it('billing · noHeader 는 차단 결과를 돌려준다', async () => {
    const billing = await parseCardBytes(utf8(buildIbkHtml('billing')));
    expect(billing).toMatchObject({
      kind: 'blocked',
      statement: '청구내역',
      code: 'BILLING',
      detected: 'ibk'
    });

    const noHeader = await parseCardBytes(utf8(buildIbkHtml('noHeader')));
    expect(noHeader).toMatchObject({
      kind: 'blocked',
      statement: '판별불가',
      code: 'NO_COLUMNS',
      detected: 'ibk'
    });
  });
});

describe('parseCardBytes — 읽을 수 없는 입력', () => {
  it('PK(xlsx) 바이트는 UNKNOWN_FORMAT 으로 막는다', async () => {
    const pk = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]).buffer;
    expect(await parseCardBytes(pk)).toEqual({
      kind: 'blocked',
      statement: '판별불가',
      code: 'UNKNOWN_FORMAT',
      why: '형식 판별 실패 — 건너뜁니다',
      detected: 'unknown'
    });
  });

  it('깨진 OLE 바이트는 UNREADABLE 로 막는다', async () => {
    const broken = new Uint8Array(512);
    broken.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const outcome = await parseCardBytes(broken.buffer);
    expect(outcome).toMatchObject({
      kind: 'blocked',
      statement: '판별불가',
      code: 'UNREADABLE',
      detected: 'kb'
    });
  });

  it('일반 HTML 표는 IBK 로 읽되 헤더 판별에서 막는다', async () => {
    const outcome = await parseCardBytes(utf8('<html><table><tr><th>이름</th><th>나이</th></tr></table></html>'));
    expect(outcome).toMatchObject({
      kind: 'blocked',
      statement: '판별불가',
      code: 'NO_COLUMNS',
      detected: 'ibk'
    });
  });
});
