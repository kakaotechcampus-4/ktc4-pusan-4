import { describe, expect, it } from 'vitest';
import { gateTrace } from './trace';
import { CARDS, cardById } from './cards';

const judgment = (over: Partial<Parameters<typeof gateTrace>[0]>) => ({
  appliedRuleIds: [],
  blockedAtGate: null,
  unmatchedReason: null,
  rulesCommitSha: null,
  ...over
});

const states = (trace: ReturnType<typeof gateTrace>) => trace.steps.map((step) => `${step.gate}:${step.state}`);
const ids = (trace: ReturnType<typeof gateTrace>, gate: string) =>
trace.steps.find((step) => step.gate === gate)?.applied.map((card) => card.id);

describe('빌드 때 옮긴 규칙 카드', () => {
  it('rules/cards 의 53장을 관문 순으로 담는다', () => {
    expect(CARDS).toHaveLength(53);
    expect(CARDS.map((card) => card.gate)).toEqual([...CARDS.map((card) => card.gate)].sort());
    expect(cardById('R-104')).toMatchObject({ gate: 'G2', name: '온라인쇼핑', verdict: 'NEEDS_REVIEW', file: 'rules/cards/R-104_온라인쇼핑.yaml' });
  });
});

describe('gateTrace', () => {
  it('G1 카드에 걸리면 그 카드 하나로 멈추고 뒤 관문은 가지 않는다', () => {
    const trace = gateTrace(judgment({ appliedRuleIds: ['R-001'], blockedAtGate: 'G1' }));
    expect(states(trace)).toEqual(['G1:stop', 'G2:unreached', 'G3:unreached', 'G4:unreached', 'G5:unreached', 'G6:unreached']);
    expect(ids(trace, 'G1')).toEqual(['R-001']);
  });

  it('맞는 규칙이 없으면 G1 을 지나 G2 에서 확인 필요로 멈춘다', () => {
    const trace = gateTrace(judgment({ blockedAtGate: 'G2', unmatchedReason: 'RULE_NOT_FOUND' }));
    expect(trace.noRule).toBe(true);
    expect(states(trace).slice(0, 3)).toEqual(['G1:pass', 'G2:stop', 'G3:unreached']);
  });

  it('G2 승자가 불가를 확정하면 승자 하나로 멈춘다', () => {
    const trace = gateTrace(judgment({ appliedRuleIds: ['R-104'], blockedAtGate: 'G2' }));
    expect(trace.noRule).toBe(false);
    expect(ids(trace, 'G2')).toEqual(['R-104']);
    expect(states(trace).slice(1, 3)).toEqual(['G2:stop', 'G3:unreached']);
  });

  it('막히지 않았으면 G2 승자와 G3~G6 에서 맞은 카드를 관문마다 둔다', () => {
    const g4 = CARDS.filter((card) => card.gate === 'G4')[0];
    const trace = gateTrace(judgment({ appliedRuleIds: ['R-104', g4.id] }));
    expect(states(trace)).toEqual(['G1:pass', 'G2:pass', 'G3:none', 'G4:applied', 'G5:none', 'G6:none']);
    expect(ids(trace, 'G4')).toEqual([g4.id]);
  });

  it('지금 빌드에 없는 카드도 첫 자리면 G2 승자로 두고, 없는 카드로 알린다', () => {
    const trace = gateTrace(judgment({ appliedRuleIds: ['R-999'] }));
    expect(ids(trace, 'G2')).toEqual(['R-999']);
    expect(trace.missing).toEqual(['R-999']);
  });

  it('빌드 커밋을 모르면 판정 당시 카드와 비교하지 않는다', () => {
    expect(gateTrace(judgment({ rulesCommitSha: 'abc' })).stale).toBe(false);
  });
});
