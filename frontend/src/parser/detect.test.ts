import { describe, expect, it } from 'vitest';
import { classifyStatement, detectFormat } from './detect';

const utf8 = (text: string) => new TextEncoder().encode(text);

describe('detectFormat', () => {
  it('OLE 매직으로 시작하면 KB 다', () => {
    const bytes = new Uint8Array(512);
    bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(detectFormat(bytes)).toBe('kb');
  });

  it('HTML 표는 앞 공백 · BOM · doctype · 대소문자와 상관없이 IBK 다', () => {
    expect(detectFormat(utf8('  <HTML><table>'))).toBe('ibk');
    expect(detectFormat(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('<html>')]))).toBe('ibk');
    expect(detectFormat(utf8('<!DOCTYPE html><table>'))).toBe('ibk');
    expect(detectFormat(utf8('<meta charset="utf-8"><table>'))).toBe('ibk');
  });

  it('첫 <table 이 앞에서 멀리 있어도 IBK 다', () => {
    const head = `<head><style>${'x'.repeat(2000)}</style></head>`;
    expect(detectFormat(utf8(`<html>${head}<body><table>`))).toBe('ibk');
    expect(detectFormat(utf8(`<meta charset="utf-8">${head}<table>`))).toBe('ibk');
  });

  it('그 밖에는 판별하지 않는다', () => {
    expect(detectFormat(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]))).toBe('unknown');
    expect(detectFormat(new Uint8Array())).toBe('unknown');
    expect(detectFormat(utf8('승인일,가맹점,금액\n2026-01-03,스타벅스,11000'))).toBe('unknown');
    expect(detectFormat(utf8('<meta charset="utf-8"><div>표 없음</div>'))).toBe('unknown');
  });
});

describe('classifyStatement', () => {
  it('가맹점명과 승인 정보가 있으면 승인내역이다. 헤더 안 공백은 무시한다', () => {
    expect(classifyStatement(['이용 하신 곳', '승인\n번호'])).toEqual({
      kind: '승인내역',
      code: 'APPROVAL',
      why: '가맹점명(이용하신곳) + 승인정보(승인번호)'
    });
  });

  it('청구 컬럼이 있고 가맹점명이 없으면 청구내역이다. 근거는 목록 순서로 앞 3개다', () => {
    expect(classifyStatement(['청구일', '카드번호', '청구금액', '청구원금', '결제원금', '잔여할부', '할부수수료'])).toEqual({
      kind: '청구내역',
      code: 'BILLING',
      why: '청구 컬럼(청구금액, 청구일, 청구원금) 있고 가맹점명 없음'
    });
  });

  it('가맹점명만 있으면 판별불가다', () => {
    expect(classifyStatement(['가맹점명', '금액'])).toEqual({
      kind: '판별불가',
      code: 'MERCHANT_WITHOUT_APPROVAL',
      why: '가맹점명은 있는데 승인정보 컬럼이 없다'
    });
  });

  it('가맹점명이 있으면 청구 컬럼이 있어도 청구내역이 아니다', () => {
    expect(classifyStatement(['가맹점명', '청구금액']).code).toBe('MERCHANT_WITHOUT_APPROVAL');
  });

  it('아무것도 못 찾으면 헤더를 코드 포인트 60개까지 보여 준다', () => {
    expect(classifyStatement([]).why).toBe('가맹점명·승인정보 컬럼을 찾지 못했다 (헤더: 없음)');
    const verdict = classifyStatement(['가'.repeat(59) + '\u{20000}'.repeat(11)]);
    expect(verdict.code).toBe('NO_COLUMNS');
    expect(verdict.why).toBe(`가맹점명·승인정보 컬럼을 찾지 못했다 (헤더: ${'가'.repeat(59)}\u{20000})`);
  });
});
