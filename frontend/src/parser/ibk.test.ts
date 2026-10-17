// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { classifyStatement } from './detect';
import { bsText, decodeIbk, ibkHeaders, readIbk } from './ibk';
import { buildIbkHtml } from './samples';

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const byId = (doc: Document, id: string): Element => {
  const el = doc.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
};

describe('bsText', () => {
  it('글자 조각을 다듬어 한 칸 띄어 잇는다', () => {
    const doc = parse('<table><tr><td id="a"><b>A</b>B</td><td id="b">&nbsp;</td><td id="c"> 매출표<br>\n 접수일자 </td></tr></table>');
    expect(bsText(byId(doc, 'a'))).toBe('A B');
    expect(bsText(byId(doc, 'b'))).toBe('');
    expect(bsText(byId(doc, 'c'))).toBe('매출표 접수일자');
  });

  it('script · style 안의 글자는 읽지 않는다', () => {
    const doc = parse('<div id="d">가<script>var x = 1;</script><style>p {}</style>나</div>');
    expect(bsText(byId(doc, 'd'))).toBe('가 나');
  });
});

describe('ibkHeaders', () => {
  it('th 가 가장 많은 행이고, 개수가 같으면 앞 행이다', () => {
    const doc = parse(
      '<table><tr><th>제목</th></tr><tr><th>a</th><th>b</th></tr><tr><th>c</th><th>d</th></tr></table>'
    );
    expect(ibkHeaders(doc)).toEqual(['a', 'b']);
    expect(ibkHeaders(parse('<p>표 없음</p>'))).toEqual([]);
  });
});

describe('decodeIbk', () => {
  it('UTF-8 로 읽고 깨진 바이트는 대체 문자로 둔다', () => {
    const bytes = new Uint8Array([...new TextEncoder().encode('<html>표'), 0xff]);
    expect(decodeIbk(bytes.buffer)).toBe('<html>표�');
  });
});

describe('readIbk — 샘플 full', () => {
  const html = buildIbkHtml('full');

  it('colspan="5.5" 제목 행과 합계 행을 지나 11칸 헤더를 고른다', () => {
    expect(html).toContain('colspan="5.5"');
    const { headers } = readIbk(html);
    expect(headers).toHaveLength(11);
    expect(headers[9]).toBe('매출표 접수일자');
    expect(classifyStatement(headers)).toEqual({
      kind: '승인내역',
      code: 'APPROVAL',
      why: '가맹점명(이용가맹점명) + 승인정보(승인번호)'
    });
  });

  it('데이터 행 22개를 모두 읽는다', () => {
    const result = readIbk(html);
    expect(result.sourceRows).toBe(22);
    expect(result.records).toHaveLength(22);
    expect(result.foreignOnlySkipped).toBe(0);
    expect(result.declaredPeriod).toBeNull();
  });

  it('행마다 값을 옮긴다', () => {
    const { records } = readIbk(html);
    expect(records[0]).toEqual({
      merchant: '스타벅스코리아 서면점',
      amount: 11000,
      bizNo: '220-81-00001',
      memo: '',
      source: 'ibk',
      approvalNo: '78968731',
      when: '2026-01-03',
      isCancel: false,
      installment: 0,
      status: null,
      needsReview: false,
      reviewReason: ''
    });
    expect(records[1]).toMatchObject({ merchant: '편의점할인', bizNo: '', isCancel: true, amount: 500 });
    expect(records[2]).toMatchObject({ merchant: '행복할인', bizNo: '2208212345', isCancel: true });
    expect(records[3].approvalNo).toBe(records[4].approvalNo);
    expect(records.map((r) => r.isCancel).filter(Boolean)).toHaveLength(8);
    expect(records[12]).toMatchObject({ merchant: '교보문고', when: '2026-03-05', isCancel: true });
    expect(records[15]).toMatchObject({ merchant: '하이마트', installment: 3, bizNo: '1234567891', amount: 1200000 });
    expect(records[16].bizNo).toBe(records[17].bizNo);
    expect(records[18]).toMatchObject({ when: null, amount: 3000 });
    expect(records[19]).toMatchObject({ merchant: '', when: '2025-12-31' });
    expect(records[20]).toMatchObject({ amount: null, when: '2026-02-28' });
    expect(records[21]).toMatchObject({ merchant: '쿠팡이츠', bizNo: '' });
  });
});

describe('readIbk — 샘플 변형', () => {
  it('billing 은 청구내역이다', () => {
    expect(classifyStatement(readIbk(buildIbkHtml('billing')).headers).code).toBe('BILLING');
  });

  it('noHeader 는 제목 행만 헤더로 잡혀 판별불가다', () => {
    const { headers } = readIbk(buildIbkHtml('noHeader'));
    expect(headers).toEqual(['기간별 사용내역 조회']);
    expect(classifyStatement(headers)).toMatchObject({ kind: '판별불가', code: 'NO_COLUMNS' });
  });
});
