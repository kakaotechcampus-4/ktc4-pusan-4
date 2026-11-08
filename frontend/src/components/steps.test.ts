import { describe, expect, it } from 'vitest';
import { doneSteps } from './steps';
import type { Progress, RunStatus } from '../types/domain';

const progress = (pendingCount: number, run: Progress['run'] = null) => ({
  classification: { pendingCount, pendingAmount: 0 },
  run
});
const run = (code: RunStatus): Progress['run'] => ({ id: 'r1', status: { code, label: code } });

describe('doneSteps', () => {
  it('올린 것이 없으면 하나도 치지 않는다', () => {
    expect([...doneSteps(null)]).toEqual([]);
  });

  it('분류할 가맹점이 남았으면 카드내역만 친다', () => {
    expect([...doneSteps(progress(4))]).toEqual(['/upload']);
  });

  it('분류를 마쳤으면 분류 확인까지, 판정이 끝났으면 판정까지 친다', () => {
    expect([...doneSteps(progress(0))]).toEqual(['/upload', '/preview']);
    expect([...doneSteps(progress(0, run('COMPLETED')))]).toEqual(['/upload', '/preview', '/run']);
    expect(doneSteps(progress(0, run('PARTIAL_FAILED'))).has('/run')).toBe(true);
  });

  it('돌고 있거나 실패한 판정은 치지 않는다', () => {
    expect(doneSteps(progress(0, run('QUEUED'))).has('/run')).toBe(false);
    expect(doneSteps(progress(0, run('RUNNING'))).has('/run')).toBe(false);
    expect(doneSteps(progress(0, run('FAILED'))).has('/run')).toBe(false);
  });

  it('분류가 다시 남아도 끝난 판정은 친다. 결과는 치지 않는다', () => {
    expect([...doneSteps(progress(2, run('COMPLETED')))]).toEqual(['/upload', '/run']);
    expect(doneSteps(progress(0, run('COMPLETED'))).has('/results')).toBe(false);
  });
});
