import type { SourceType, UploadBatchRequest } from '../types/domain';

/**
 * 브라우저 카드내역 파서의 공용 타입.
 * 규칙의 원본은 tools/parsers/ (Python) 이다. 여기 타입은 그 출력을 화면·업로드 계약에 맞게 옮긴 것이다.
 */

export type SourceCard = 'kb' | 'ibk';
export type DetectedFormat = SourceCard | 'unknown';
/** 파서가 붙이는 원본 상태. 업로드 계약의 SourceStatus 로 바꿔 보낸다 */
export type ParserStatus = '판정대상' | '취소상계' | '대상제외';

/** 없는 셀은 undefined. 문자는 그대로, 숫자는 숫자로 */
export type Cell = string | number | boolean | undefined;

export interface Grid {
  readonly nrows: number;
  readonly ncols: number;
  cell(r: number, c: number): Cell;
}

/** Python make_record. 파이프라인이 status · needsReview · reviewReason 을 채운다 */
export interface RawRecord {
  merchant: string;
  amount: number | null;
  bizNo: string;
  memo: string;
  source: SourceCard;
  approvalNo: string;
  /** YYYY-MM-DD. 읽지 못하면 null */
  when: string | null;
  isCancel: boolean;
  installment: number;
  status: ParserStatus | null;
  needsReview: boolean;
  reviewReason: string;
}

export interface AdapterResult {
  headers: string[];
  records: RawRecord[];
  /** 가맹점명이 있는 원본 행 수 (Python st.total) */
  sourceRows: number;
  /** 원화 금액 없이 외화만 있어 읽지 않은 행 */
  foreignOnlySkipped: number;
  /** KB 파일 머리의 조회기간. IBK 파일에는 없어서 항상 null */
  declaredPeriod: { start: string; end: string } | null;
}

export type StatementCode = 'APPROVAL' | 'BILLING' | 'MERCHANT_WITHOUT_APPROVAL' | 'NO_COLUMNS';

/** why 는 Python 문구 그대로다(대조 테스트용). 화면은 code 로 자기 문구를 고른다 */
export interface StatementVerdict {
  kind: SourceType;
  code: StatementCode;
  why: string;
}

/** Python to_rows 출력에서 branch · branch_raw 를 뺀 것. isCancel · masked 는 내부용이다 */
export interface ParsedRow {
  approvedAt: string;
  rawMerchant: string;
  amount: number | null;
  installmentMonths: number;
  approvalNo: string;
  naturalKey: string;
  bizNo: string;
  memo: string;
  sourceCard: SourceCard;
  status: ParserStatus;
  isAggregated: boolean;
  needsReview: boolean;
  reviewReason: string;
  isCancel: boolean;
  masked: boolean;
}

export interface ParseStats {
  sourceRows: number;
  foreignOnlySkipped: number;
  kept: number;
  byStatus: Record<ParserStatus, number>;
  nonTransaction: number;
  cancels: number;
  cancelsPaired: number;
  cancelsAmbiguous: number;
  cancelsUnpaired: number;
  noAmount: number;
  noDate: number;
  aggregated: number;
  medicalMasked: number;
  needsReview: number;
}

/** 서버가 받지 않는 행. 하나라도 보내면 업로드 전체가 400/422 로 실패한다 */
export type UnsendableCode = 'NO_DATE' | 'NO_AMOUNT' | 'BLANK_MERCHANT' | 'APPROVAL_TOO_LONG';

export interface UnsendableRow {
  /** rows 안의 위치 */
  index: number;
  code: UnsendableCode;
  row: ParsedRow;
}

export type BlockedCode = Exclude<StatementCode, 'APPROVAL'> | 'UNKNOWN_FORMAT' | 'UNREADABLE';

export interface BlockedOutcome {
  kind: 'blocked';
  statement: '청구내역' | '판별불가';
  code: BlockedCode;
  why: string;
  detected: DetectedFormat;
}

export interface ParsedOutcome {
  kind: 'parsed';
  issuer: SourceCard;
  rows: ParsedRow[];
  /** 보낼 행이 하나도 없으면 null */
  request: UploadBatchRequest | null;
  unsendable: UnsendableRow[];
  stats: ParseStats;
}

export type ParseOutcome = BlockedOutcome | ParsedOutcome;
