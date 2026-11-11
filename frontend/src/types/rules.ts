import type { GateId, Verdict } from './domain';

/**
 * 빌드 때 rules/cards 에서 옮긴 카드 한 장(scripts/rules-data.mjs). 화면이 쓰는 필드만 있다
 */
export interface RuleCardInfo {
  id: string;
  /** 파일 이름의 밑줄 뒤. R-104_온라인쇼핑.yaml 이면 온라인쇼핑 */
  name: string;
  gate: GateId;
  priority: number;
  /** 속성만 붙이는 카드(G4 자산 등)는 판정이 없다 */
  verdict: Verdict | null;
  categories: string[];
  industries: string[];
  /** 가맹점 이름에 든 말로 맞추는 카드(조세 키워드 등) */
  keywords: string[];
  /** 이 금액 이상(원). 없으면 null */
  amountMin: number | null;
  /** 이 금액 이하(원). 없으면 null */
  amountMax: number | null;
  /** 주말이나 공휴일 결제에만 맞는다 */
  holiday: boolean;
  /** 근거 조문 id */
  citations: string[];
  question: { text: string; options: string[] } | null;
  outOfScope: boolean;
  /** review.by 가 미검수가 아니다 */
  reviewed: boolean;
  reviewBy: string;
  reviewDate: string | null;
  /** 저장소 안의 경로. rules/cards/R-104_온라인쇼핑.yaml */
  file: string;
}

/** rules/glossary.yaml 한 항목 */
export interface GlossaryTerm {
  term: string;
  aliases: string[];
  body: string;
  /** 근거 조문 id */
  statute?: string;
}

/** eval/cases 한 건 */
export interface EvalCaseInfo {
  id: string;
  /** G1~G6 또는 엣지 */
  gate: string;
  title: string;
  industry: string | null;
  category: string;
  expected: Verdict;
  expectedGate: string | null;
  critical: boolean;
}
