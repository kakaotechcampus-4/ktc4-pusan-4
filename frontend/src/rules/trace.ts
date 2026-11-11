import type { GateId, Judgment } from '../types/domain';
import type { RuleCardInfo } from '../types/rules';
import { BUILD_SHA, GATES, cardById } from './cards';

/**
 * 관문 하나를 거래가 어떻게 지났는가.
 * - stop: 여기서 판정이 정해져 뒤 관문으로 가지 않았다(G1 막힘, G2 불가 확정, G2 맞는 규칙 없음)
 * - pass: 지났다. G1 은 막는 카드가 없었고, G2 는 승자 카드가 있다
 * - applied: G3~G6 에서 맞은 카드가 있다
 * - none: 갔지만 적용된 카드가 없다
 * - unreached: 앞에서 멈춰 가지 않았다
 */
export type GateState = 'stop' | 'pass' | 'applied' | 'none' | 'unreached';

export interface GateStep {
  gate: GateId;
  name: string;
  state: GateState;
  /** 이 관문에서 적용된 카드. 빌드에 없는 id 는 id 만 있다 */
  applied: (RuleCardInfo | {id: string;})[];
}

export interface GateTrace {
  steps: GateStep[];
  /** 맞는 규칙이 없어 G2 에서 확인 필요로 멈췄다 */
  noRule: boolean;
  /** 판정에 적용됐지만 지금 빌드의 카드에 없는 id */
  missing: string[];
  /** 판정 당시 규칙 커밋이 지금 화면을 빌드한 커밋과 다르다. 어느 쪽이든 모르면 false */
  stale: boolean;
}

/**
 * 판정의 appliedRuleIds 와 blockedAtGate 로 관문을 따라간다(JudgmentEngine.judge).
 * - G1 카드가 맞으면 그 카드 하나로 끝나고 blockedAtGate 가 G1 이다
 * - G2 승자가 없으면 appliedRuleIds 가 비고 blockedAtGate 가 G2 다(RULE_NOT_FOUND)
 * - G2 승자가 불가를 확정하면 승자 하나로 끝나고 blockedAtGate 가 G2 다
 * - 아니면 G2 승자와 G3~G6 에서 맞은 카드가 관문 순으로 들어 있다
 * 판정 쪽 서버는 고치지 않는다. 지금 판정에 이미 있는 값만 쓴다
 */
export function gateTrace(judgment: Pick<Judgment, 'appliedRuleIds' | 'blockedAtGate' | 'unmatchedReason' | 'rulesCommitSha'>): GateTrace {
  const applied = judgment.appliedRuleIds.map((id) => cardById(id) ?? { id });
  const missing = applied.filter((card) => !('gate' in card)).map((card) => card.id);
  const blocked = judgment.blockedAtGate;
  const noRule = blocked === 'G2' && (judgment.appliedRuleIds.length === 0 || judgment.unmatchedReason === 'RULE_NOT_FOUND');
  const stopAt = blocked === 'G1' || blocked === 'G2' ? blocked : null;
  const stopIndex = stopAt ? GATES.findIndex((gate) => gate.id === stopAt) : -1;
  /*
   * 첫 카드는 자리로 관문을 안다. G1 에서 막혔으면 G1 카드, 아니면 G2 승자다.
   * 그래서 지금 빌드에 없는 카드(지운 카드)라도 그 자리에 둔다. 나머지는 G3~G6 카드라 카드의 관문을 따른다
   */
  const [first, ...rest] = applied;
  const firstGate: GateId | null = !first ? null : blocked === 'G1' ? 'G1' : 'G2';
  const cardsAt = (gate: GateId) => [
  ...(first && firstGate === gate ? [first] : []),
  ...rest.filter((card) => 'gate' in card && card.gate === gate)];


  const steps = GATES.map((gate, index): GateStep => {
    const step = (state: GateState, cards: GateStep['applied'] = []): GateStep => ({ gate: gate.id, name: gate.name, state, applied: cards });
    const cards = cardsAt(gate.id);
    if (stopIndex >= 0 && index > stopIndex) return step('unreached');
    if (index === stopIndex) return step('stop', cards);
    if (gate.id === 'G1') return step('pass');
    if (gate.id === 'G2') return step(cards.length > 0 ? 'pass' : 'none', cards);
    return step(cards.length > 0 ? 'applied' : 'none', cards);
  });

  return {
    steps,
    noRule,
    missing,
    stale: Boolean(BUILD_SHA && judgment.rulesCommitSha && judgment.rulesCommitSha !== BUILD_SHA)
  };
}
