import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../api/contract';
import type { JudgmentRun, RunStatus } from '../types/domain';
import { pollErrorOf, runPhase } from './runPhase';

const run = (code: RunStatus, totalCount = 9): JudgmentRun => ({
  id: 'r',
  batchId: 'b',
  contextId: 'c',
  contextVersion: 1,
  status: { code, label: code },
  totalCount,
  processedCount: 0,
  failedCount: 0,
  startedAt: null,
  completedAt: null
});

describe('runPhase', () => {
  it('아직 받지 않았으면 loading 이다', () => {
    expect(runPhase(null)).toBe('loading');
  });

  it('대기와 진행은 running 이다', () => {
    expect(runPhase(run('QUEUED'))).toBe('running');
    expect(runPhase(run('RUNNING'))).toBe('running');
  });

  it('끝난 상태를 나눈다', () => {
    expect(runPhase(run('COMPLETED'))).toBe('completed');
    expect(runPhase(run('PARTIAL_FAILED'))).toBe('partial');
    expect(runPhase(run('FAILED'))).toBe('failed');
  });

  it('0건으로 끝난 실행은 다 통과한 것이 아니라 판정할 거래가 없는 것이다 (C39)', () => {
    expect(runPhase(run('COMPLETED', 0))).toBe('empty');
    expect(runPhase(run('FAILED', 0))).toBe('failed');
  });
});

describe('pollErrorOf', () => {
  it('404 는 없는 실행, 400 은 잘못된 주소다', () => {
    expect(pollErrorOf(new ApiRequestError(404, 'RUN_NOT_FOUND', ''))).toBe('missing');
    expect(pollErrorOf(new ApiRequestError(400, 'INVALID_ID', ''))).toBe('badAddress');
  });

  it('서버 오류와 끊긴 연결은 다시 묻는다 (C63)', () => {
    expect(pollErrorOf(new ApiRequestError(500, 'INTERNAL', ''))).toBe('transient');
    expect(pollErrorOf(new ApiRequestError(503, 'UNAVAILABLE', ''))).toBe('transient');
    expect(pollErrorOf(new TypeError('Failed to fetch'))).toBe('transient');
  });
});
