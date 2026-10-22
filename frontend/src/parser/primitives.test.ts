import { describe, expect, it } from 'vitest';
import {
  AGGREGATED_RE,
  MEDICAL_RE,
  NON_TRANSACTION_RE,
  cellText,
  dayNumber,
  makeRecord,
  normBizno,
  parseAmount,
  parseDate,
  parseInstallment } from
'./primitives';

describe('cellText', () => {
  it('읽지 못한 셀은 빈 문자열이다', () => {
    expect(cellText(undefined)).toBe('');
  });

  it('숫자 셀은 정수면 소수점 없이 읽는다', () => {
    expect(cellText(30000001)).toBe('30000001');
    expect(cellText(12.34)).toBe('12.34');
    expect(cellText(-0)).toBe('0');
  });

  it('문자는 그대로, 불리언은 1/0 이다', () => {
    expect(cellText(' a ')).toBe(' a ');
    expect(cellText(true)).toBe('1');
  });
});

describe('parseAmount', () => {
  it('숫자 셀은 정수로 반올림한다', () => {
    expect(parseAmount(4500)).toBe(4500);
    expect(parseAmount(4500.4)).toBe(4500);
    expect(parseAmount(-0.4)).toBe(0);
  });

  it('문자는 숫자와 부호만 남겨 읽는다', () => {
    expect(parseAmount('11,000')).toBe(11000);
    expect(parseAmount('-11,000원')).toBe(-11000);
  });

  it('정수 하나로 읽히지 않으면 null 이다', () => {
    expect(parseAmount('1-2')).toBeNull();
    expect(parseAmount('--5')).toBeNull();
    expect(parseAmount('-')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount(Number.NaN)).toBeNull();
  });
});

describe('parseDate', () => {
  it('세 가지 구분자를 YYYY-MM-DD 로 바꾼다', () => {
    expect(parseDate('2026-01-03')).toBe('2026-01-03');
    expect(parseDate('2026.1.3')).toBe('2026-01-03');
    expect(parseDate('2026/01/03')).toBe('2026-01-03');
  });

  it('시각이 붙은 승인일시는 앞 10자만 읽는다', () => {
    expect(parseDate('2026-01-03 12:30:11')).toBe('2026-01-03');
    expect(parseDate('2026.01.01 09:00:00')).toBe('2026-01-01');
  });

  it('앞 10자가 날짜로 끝나지 않으면 읽지 않는다', () => {
    expect(parseDate('2026/1/3 12:00')).toBeNull();
  });

  it('없는 날짜와 섞인 구분자는 읽지 않는다', () => {
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('2026-13-01')).toBeNull();
    expect(parseDate('0000-01-01')).toBeNull();
    expect(parseDate('2026.01-03')).toBeNull();
  });

  it('윤년 2월 29일은 읽는다', () => {
    expect(parseDate('2024-02-29')).toBe('2024-02-29');
    expect(parseDate('2026-02-29')).toBeNull();
  });

  it('숫자 셀(엑셀 날짜 일련번호)은 읽지 않는다', () => {
    expect(parseDate(46040)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});

describe('parseInstallment', () => {
  it('N개월 표기에서 개월 수를 뽑는다', () => {
    expect(parseInstallment('할부 12 개월')).toBe(12);
    expect(parseInstallment('국내할부(3개월)')).toBe(3);
    expect(parseInstallment('6월')).toBe(6);
  });

  it('일시불이나 숫자 셀은 0 이다', () => {
    expect(parseInstallment('일시불')).toBe(0);
    expect(parseInstallment('국내체크일시불')).toBe(0);
    expect(parseInstallment(3)).toBe(0);
  });
});

describe('normBizno', () => {
  it('형식이 맞으면 공백만 지우고 하이픈은 둔다', () => {
    expect(normBizno('123-45-67890')).toBe('123-45-67890');
    expect(normBizno('1234567890')).toBe('1234567890');
    expect(normBizno('123 45 67891')).toBe('1234567891');
  });

  it('형식이 맞지 않으면 빈 문자열이다', () => {
    expect(normBizno('12-345-67890')).toBe('');
    expect(normBizno('')).toBe('');
    expect(normBizno(undefined)).toBe('');
  });
});

describe('dayNumber', () => {
  it('62일 차이를 시간대와 관계없이 센다', () => {
    expect(dayNumber('2026-03-04') - dayNumber('2026-01-01')).toBe(62);
    expect(dayNumber('2026-03-05') - dayNumber('2026-01-01')).toBe(63);
  });

  it('윤년 2월을 센다', () => {
    expect(dayNumber('2024-03-03') - dayNumber('2024-01-01')).toBe(62);
  });
});

describe('행 판별 정규식', () => {
  it('비거래 항목은 할인으로 끝나는 한 줄이다', () => {
    expect(NON_TRANSACTION_RE.test('정상할인')).toBe(true);
    expect(NON_TRANSACTION_RE.test('포인트사용')).toBe(true);
    expect(NON_TRANSACTION_RE.test('편의점할인')).toBe(true);
    expect(NON_TRANSACTION_RE.test('할인마트')).toBe(false);
    expect(NON_TRANSACTION_RE.test('편의점\n할인')).toBe(false);
  });

  it('합산 행은 교통·지하철·버스 접두어 뒤에 구분자가 온다', () => {
    expect(AGGREGATED_RE.test('지하철_모바일 50 건')).toBe(true);
    expect(AGGREGATED_RE.test('교통-카드')).toBe(true);
    expect(AGGREGATED_RE.test('교통카드')).toBe(false);
  });

  it('의료 업종은 상호 어디든 업종어가 있으면 잡는다', () => {
    expect(MEDICAL_RE.test('서면연세의원')).toBe(true);
    expect(MEDICAL_RE.test('해운대치과')).toBe(true);
    expect(MEDICAL_RE.test('스타벅스')).toBe(false);
  });
});

describe('makeRecord', () => {
  it('상호와 승인번호의 앞뒤 공백을 지우고 숫자 승인번호는 정수로 읽는다', () => {
    const record = makeRecord({
      merchant: '  스타벅스 ',
      amount: 11000,
      source: 'kb',
      approvalNo: 30000001,
      when: '2026-01-03',
      installment: 0,
      isCancel: false
    });
    expect(record).toEqual({
      merchant: '스타벅스',
      amount: 11000,
      bizNo: '',
      memo: '',
      source: 'kb',
      approvalNo: '30000001',
      when: '2026-01-03',
      isCancel: false,
      installment: 0,
      status: null,
      needsReview: false,
      reviewReason: ''
    });
  });
});
