import type { Verdict } from '../types/domain';
import type { BadgeTone } from '../components/ui/Badge';

/**
 * 판정 3분류의 시각 표현. 라벨은 API가 {code,label}로 내려주므로 여기 두지 않는다.
 * 색각이상 대응: 색 + 기호를 항상 함께 쓴다.
 */
export const VERDICT_META: Record<Verdict, { symbol: string; tone: BadgeTone }> = {
  AVAILABLE: { symbol: '✓', tone: 'ok' },
  NEEDS_REVIEW: { symbol: '?', tone: 'warn' },
  UNAVAILABLE: { symbol: '✕', tone: 'deny' }
};

/** 사용자 조작(Override)처럼 프론트가 code만 아는 경우의 라벨. 서버 응답이 있으면 그것을 쓴다. */
export const VERDICT_LABEL: Record<Verdict, string> = {
  AVAILABLE: '가능',
  NEEDS_REVIEW: '확인 필요',
  UNAVAILABLE: '불가'
};
