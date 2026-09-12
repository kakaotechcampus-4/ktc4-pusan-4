export type Verdict = 'POSSIBLE' | 'NEEDS_REVIEW' | 'IMPOSSIBLE';

export type GateId = 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';

export type StatuteHierarchy =
'법률' |
'시행령' |
'시행규칙' |
'기본통칙' |
'고시' |
'심판례' |
'판례';

/** 근거로 인용 가능한 것과 참고 해석기준을 화면에서 구분한다. */
export type CitationRole = 'EVIDENCE' | 'REFERENCE';

export interface Statute {
  statuteId: string;
  label: string;
  hierarchy: StatuteHierarchy;
  role: CitationRole;
  effectiveFrom: string;
  effectiveTo: string | null;
  statuteVersionId: number;
  body: string;
}

export interface Transaction {
  id: string;
  transactedAt: string;
  merchantRaw: string;
  merchantNorm: string;
  merchantCategory: string;
  amount: number;
  installmentMonths: number;
}

export interface GateTraceStep {
  gate: GateId;
  result: string;
}

export type ReasonCode =
'PURPOSE_UNKNOWN' |
'RATIO_MISSING' |
'PERIOD_UNKNOWN' |
'EXCLUSIVE_USE_UNKNOWN' |
'MERCHANT_UNRESOLVED';

export interface Judgment {
  id: string;
  transaction: Transaction;
  verdict: Verdict;
  /** 막힌 게이트 심볼. 통과 시 null */
  blockedAtGate: string | null;
  reasonCode: ReasonCode | null;
  isInference: boolean;
  finalAmount: number;
  /** 안분율(%) — 해당 없으면 null */
  ratio: number | null;
  ruleCardId: string;
  reason: string;
  citations: string[];
  documents: string[];
  gateTrace: GateTraceStep[];
  groupKey: string | null;
}

export interface AnswerOption {
  value: string;
  label: string;
  hint?: string;
}

export interface QuestionGroup {
  groupKey: string;
  reasonCode: ReasonCode;
  reasonLabel: string;
  merchantLabel: string;
  count: number;
  amount: number;
  question: string;
  helper: string;
  answerType: 'CHOICE' | 'RATIO';
  options: AnswerOption[];
  sampleMerchants: string[];
}

export type WorkplaceType = 'HOME' | 'OFFICE' | 'NONE';

export interface BusinessContext {
  industryCode: string;
  prevYearRevenue: number;
  businessOpenDate: string;
  hasEmployees: boolean;
  workplaceType: WorkplaceType;
  homeOfficeRatio: number;
  hasVehicle: boolean;
  hasPhysicalFacility: boolean;
}

export type UploadSourceType = 'APPROVAL' | 'BILLING' | 'UNKNOWN';

export interface SampleFile {
  id: string;
  fileName: string;
  issuer: string;
  format: 'XLSX' | 'CSV';
  sourceType: UploadSourceType;
  rowCount: number;
  periodStart: string;
  periodEnd: string;
  encoding: string;
  headerRow: number;
}

export interface ParsedBatch {
  fileName: string;
  issuer: string;
  format: 'XLSX' | 'CSV';
  rowCount: number;
  periodStart: string;
  periodEnd: string;
  encoding: string;
}