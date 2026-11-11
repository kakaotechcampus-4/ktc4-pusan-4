import type { RuleCardInfo } from '../types/rules';
import { categoryLabel } from '../components/results/display';
import { formatNumber, ro } from '../utils/format';

/** 30000 은 3만 원, 그 밖은 원 단위 그대로 */
const won = (amount: number) => amount % 10000 === 0 ? `${formatNumber(amount / 10000)}만 원` : `${formatNumber(amount)}원`;

/** 카드가 맞는 결제. 「주말이나 공휴일의 음식점 결제」, 「10만 원 넘는 해외SaaS 결제」, 「가산금, 강제징수 같은 말이 든 결제」 */
function subjectOf(card: RuleCardInfo) {
  const amount =
  card.amountMin !== null ? `${won(card.amountMin - 1)} 넘는` : card.amountMax !== null ? `${won(card.amountMax)} 이하` : null;
  // 이름에 든 말로 맞추는 카드는 카테고리(대개 기타)보다 그 말이 카드를 설명한다
  const what =
  card.keywords.length > 0 ?
  `${card.keywords.slice(0, 2).join(', ')} 같은 말이 든 결제` :
  card.categories.length > 0 ?
  `${card.categories.map(categoryLabel).join(', ')} 결제` :
  '결제';
  return [card.holiday ? '주말이나 공휴일의' : null, amount, what].filter(Boolean).join(' ');
}

/** 카드가 하는 일. 판정이 없는 카드(자산, 증빙)는 표시만 붙인다 */
function outcomeOf(card: RuleCardInfo) {
  const asked = card.question !== null;
  if (card.outOfScope) return '세무사에게 넘깁니다.';
  if (card.verdict === 'NEEDS_REVIEW') return asked ? '질문에 답하면 정합니다.' : '확인 필요로 둡니다.';
  if (card.verdict) {
    const label = card.verdict === 'AVAILABLE' ? '가능' : '불가';
    return `${label}${ro(label)} 판정합니다.${asked ? ' 질문에 답하면 바뀔 수 있습니다.' : ''}`;
  }
  if (card.gate === 'G4') return asked ? '자산으로 볼지 질문에 답하면 정합니다.' : '바로 경비로 처리하는 자산으로 표시합니다.';
  if (card.gate === 'G5') return '적격증빙이 필요하다고 표시합니다.';
  return asked ? '질문에 답하면 정합니다.' : '표시만 붙입니다.';
}

/**
 * 판정 경로 그래프에서 카드에 마우스를 올리면 보이는 한 줄. 카드 YAML 의 맞추는 조건과 판정으로 만든다.
 * 업종 조건은 쓰지 않는다. 지금 판정하는 업종이 하나뿐이다
 */
export const cardSummary = (card: RuleCardInfo) => `${subjectOf(card)}는 ${outcomeOf(card)}`;
