import { ApiRequestError } from '../api/contract';
import type { JudgmentRun } from '../types/domain';

/**
 * 판정 화면이 그리는 상태. empty 는 끝났는데 판정한 거래가 없는 실행이다 — 0건이 다 통과한 것처럼
 * 보이지 않게 따로 둔다 (C39)
 */
export type RunPhase = 'loading' | 'running' | 'empty' | 'completed' | 'partial' | 'failed';

export function runPhase(run: JudgmentRun | null): RunPhase {
  if (!run) return 'loading';
  switch (run.status.code) {
    case 'COMPLETED':
      return run.totalCount === 0 ? 'empty' : 'completed';
    case 'PARTIAL_FAILED':
      return 'partial';
    case 'FAILED':
      return 'failed';
    default:
      return 'running';
  }
}

/**
 * 상태 조회가 실패한 까닭. missing(404, 없는 실행)·badAddress(400, 실행 id 모양이 아님)는 다시 물어도
 * 같아서 멈춘다. 그 밖은 잠깐 끊긴 것으로 보고 다음 주기에 다시 묻는다 (C63)
 */
export type PollError = 'missing' | 'badAddress' | 'transient';

export function pollErrorOf(caught: unknown): PollError {
  if (caught instanceof ApiRequestError) {
    if (caught.status === 404) return 'missing';
    if (caught.status === 400) return 'badAddress';
  }
  return 'transient';
}
