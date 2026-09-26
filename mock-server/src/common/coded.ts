export interface Coded<C extends string> {
  code: C;
  label: string;
}

export function coded<C extends string>(code: C, table: Record<C, string>): Coded<C> {
  return { code, label: table[code] };
}

export const VERDICT_LABELS = {
  AVAILABLE: '가능',
  UNAVAILABLE: '불가',
  NEEDS_REVIEW: '확인 필요',
} as const;
export type Verdict = keyof typeof VERDICT_LABELS;

export const SOURCE_STATUS_LABELS = {
  JUDGEABLE: '판정대상',
  CANCELED_OFFSET: '취소상계',
  EXCLUDED: '대상제외',
} as const;
export type SourceStatusCode = keyof typeof SOURCE_STATUS_LABELS;

export const CLASSIFICATION_STATUS_LABELS = {
  CLASSIFIED: '분류 완료',
  NEEDS_REVIEW: '분류 확인 필요',
} as const;
export type ClassificationStatusCode = keyof typeof CLASSIFICATION_STATUS_LABELS;

export const QUESTION_STATUS_LABELS = {
  PENDING: '대기',
  ANSWERED: '응답',
  CANCELED: '취소',
} as const;
export type QuestionStatusCode = keyof typeof QUESTION_STATUS_LABELS;

export const REVIEW_STATUS_LABELS = {
  PENDING: '대기',
  RESOLVED: '해결',
} as const;
export type ReviewStatusCode = keyof typeof REVIEW_STATUS_LABELS;

export const RUN_STATUS_LABELS = {
  QUEUED: '대기',
  RUNNING: '실행 중',
  COMPLETED: '완료',
  PARTIAL_FAILED: '부분 실패',
  FAILED: '전체 실패',
} as const;
export type RunStatusCode = keyof typeof RUN_STATUS_LABELS;

/**
 * effectiveStatus = sourceStatus + userInclusion 조합 결과 (docs/api.md 2.3).
 * userInclusion 자체는 공통 규칙(1.5)의 예외로 bare string으로 응답한다.
 */
export function computeEffectiveStatus(
  sourceStatus: SourceStatusCode,
  userInclusion: 'AUTO' | 'INCLUDED' | 'EXCLUDED',
): SourceStatusCode {
  if (sourceStatus === 'CANCELED_OFFSET') return 'CANCELED_OFFSET';
  if (userInclusion === 'EXCLUDED') return 'EXCLUDED';
  if (userInclusion === 'INCLUDED') return 'JUDGEABLE';
  return sourceStatus;
}
