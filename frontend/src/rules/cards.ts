import cards from 'virtual:rule-cards';
import type { GateId } from '../types/domain';
import type { RuleCardInfo } from '../types/rules';

/** 빌드 때 rules/cards 에서 옮긴 카드. 관문 순, 관문 안에서는 엔진이 맞춰 보는 순서(우선순위 높은 것부터)다 */
export const CARDS: readonly RuleCardInfo[] = cards;

/** 판정 관문. 이름은 용어집(rules/glossary.yaml 관문)의 순서와 같다 */
export const GATES: readonly {id: GateId;name: string;}[] = [
{ id: 'G1', name: '불산입' },
{ id: 'G2', name: '통상성' },
{ id: 'G3', name: '안분' },
{ id: 'G4', name: '자산' },
{ id: 'G5', name: '증빙' },
{ id: 'G6', name: '한도' }];


const BY_ID = new Map(CARDS.map((card) => [card.id, card]));

export const cardById = (id: string): RuleCardInfo | undefined => BY_ID.get(id);

export const cardsOf = (gate: GateId): RuleCardInfo[] => CARDS.filter((card) => card.gate === gate);

/** 저장소가 공개라 카드 원본으로 바로 잇는다 */
const REPO = 'https://github.com/kakaotechcampus-4/ktc4-pusan-4/blob/develop/';
export const cardUrl = (card: RuleCardInfo) => `${REPO}${card.file.split('/').map(encodeURIComponent).join('/')}`;

/** 이 화면을 빌드한 커밋. 로컬 빌드는 비어 있어 비교하지 않는다 */
export const BUILD_SHA = import.meta.env.VITE_RULES_COMMIT_SHA || null;
