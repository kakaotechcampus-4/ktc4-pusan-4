import type { Cell, ParserStatus, RawRecord, SourceCard } from './types';

/**
 * 카드사와 상관없는 값 해석. tools/parsers/__init__.py 의 규칙을 옮겼다.
 *
 * Python 런타임의 흔적은 따르지 않는다. xlrd 는 숫자 셀을 float 로 넘겨 str() 하면
 * '30000001.0' 이 되는데, 그건 규칙이 아니라 우연이다. 숫자 셀은 정수 문자열로 읽는다.
 */

/** 노션 transaction.status 를 그대로 쓴다. 파서는 모든 행을 내보내고 status 만 붙인다 */
export const ST_TARGET: ParserStatus = '판정대상';
export const ST_OFFSET: ParserStatus = '취소상계';
export const ST_EXCLUDED: ParserStatus = '대상제외';

/**
 * 비거래 항목. 지출이 아니라 카드사가 만든 정산 행이다.
 * '할인으로 끝남' 만으로는 '포인트사용' 을 못 잡아서 목록을 명시한다.
 * biz_no 가 있으면 제외하지 않는다 ('○○할인마트' 는 실제 가맹점이다).
 */
export const NON_TRANSACTION_RE = /^(정상할인|포인트사용|[^\n]*할인)$/;

/** 카드사가 여러 승인을 하나로 묶은 합산 행. 제외하지 않고 표시만 한다 (여비교통 후보) */
export const AGGREGATED_RE = /^(교통[-_]|지하철[-_]|버스[-_]|시외버스[-_])/;

export const MEDICAL_RE = /(병원|의원|약국|한의원|치과|의료원|보건소)/;
export const MEDICAL_PREFIX = '의료_마스킹';

export const BIZNO_RE = /^\d{3}-?\d{2}-?\d{5}$/;

/** 취소-원결제 폴백 매칭에서 허용하는 날짜 차이 */
export const PAIR_WINDOW_DAYS = 62;

export const CANCEL_MARK = '취소';

export type ParserErrorCode = 'KB_READ' | 'HASH_UNAVAILABLE';

export class ParserError extends Error {
  constructor(
  public readonly code: ParserErrorCode,
  message: string)
  {
    super(message);
    this.name = 'ParserError';
  }
}

/** -0 을 0 으로. 금액 0 과 -0 을 다르게 다루지 않는다 */
const noNegativeZero = (n: number) => n === 0 ? 0 : n;

/** 셀을 문자열로. 없는 셀은 '', 숫자는 String (정수면 소수점이 붙지 않는다) */
export function cellText(cell: Cell): string {
  if (cell === undefined) return '';
  if (typeof cell === 'number') return String(noNegativeZero(cell));
  if (typeof cell === 'boolean') return cell ? '1' : '0';
  return cell;
}

/** 금액. 숫자 셀은 반올림, 문자는 숫자와 부호만 남겨 정수로 읽는다. 못 읽으면 null */
export function parseAmount(cell: Cell): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? noNegativeZero(Math.round(cell)) : null;
  const digits = cellText(cell).replace(/[^\d-]/g, '');
  if (!/^-?\d+$/.test(digits)) return null;
  return noNegativeZero(Number(digits));
}

const DATE_RE = /^(\d{4})([-./])(\d{1,2})\2(\d{1,2})$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * 승인일. 앞 10자를 YYYY-MM-DD · YYYY.MM.DD · YYYY/MM/DD 로 읽어 YYYY-MM-DD 로 돌려준다.
 * 시각은 버린다. 숫자 셀(엑셀 날짜 일련번호)은 읽지 않는다 — Python 도 읽지 못한다.
 */
export function parseDate(cell: Cell): string | null {
  if (typeof cell !== 'string') return null;
  const match = DATE_RE.exec(cell.trim().slice(0, 10));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[3]);
  const day = Number(match[4]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return `${match[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 결제방법 · 이용구분에서 할부 개월을 뽑는다. 일시불이면 0 */
export function parseInstallment(cell: Cell): number {
  const match = /(\d+)\s*개?월/.exec(cellText(cell));
  return match ? Number(match[1]) : 0;
}

/** 사업자번호. 공백을 지우고 형식이 맞을 때만 돌려준다(하이픈은 그대로) */
export function normBizno(cell: Cell): string {
  const text = cellText(cell).replace(/\s/g, '');
  return BIZNO_RE.test(text) ? text : '';
}

/** YYYY-MM-DD 를 UTC 기준 일수로. 시간대에 따라 하루가 밀리지 않게 Date 문자열 파싱을 쓰지 않는다 */
export function dayNumber(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return Math.round(date.getTime() / 86_400_000);
}

export interface RecordFields {
  merchant: string;
  amount: number | null;
  source: SourceCard;
  approvalNo: Cell;
  when: string | null;
  installment: number;
  isCancel: boolean;
  bizNo?: string;
  memo?: string;
}

/** Python make_record. 승인번호 · 날짜는 취소 페어링과 natural_key 에 쓴다 */
export function makeRecord(fields: RecordFields): RawRecord {
  return {
    merchant: fields.merchant.trim(),
    amount: fields.amount,
    bizNo: fields.bizNo ?? '',
    memo: fields.memo ?? '',
    source: fields.source,
    approvalNo: cellText(fields.approvalNo).trim(),
    when: fields.when,
    isCancel: fields.isCancel,
    installment: fields.installment,
    status: null,
    needsReview: false,
    reviewReason: ''
  };
}
