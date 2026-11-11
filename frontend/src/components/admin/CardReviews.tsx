import { ArrowUpRightIcon } from 'lucide-react';
import { CARDS, GATES, cardUrl } from '../../rules/cards';
import { VERDICT_LABEL } from '../../utils/verdict';
import { categoryLabel } from '../results/display';
import { VerdictBadge } from '../VerdictBadge';
import { formatNumber } from '../../utils/format';

/**
 * 카드 검토 대기열의 화면 몫(todo/README.md 5장). 카드 YAML 의 review.by 가 미검수인 카드다.
 * 여러 사람이 고친 카드와 법이 바뀐 카드는 서버의 대기열 API 가 생기면 함께 들어온다.
 * 검토는 카드 파일에서 하고, 검토하면 review 를 고친 PR 이 머지되어 다음 빌드부터 빠진다
 */
export function CardReviews() {
  const unreviewed = CARDS.filter((card) => !card.reviewed);
  const reviewed = CARDS.length - unreviewed.length;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-body text-ink">
          검토하지 않은 카드 <b className="tabular-nums">{formatNumber(unreviewed.length)}장</b>
        </p>
        <p className="text-small tabular-nums text-ink2">
          검토한 카드 {formatNumber(reviewed)} / {formatNumber(CARDS.length)}
        </p>
      </div>
      {/* 한 계열이라 accent 하나다 */}
      <div
        role="meter"
        aria-label="검토한 카드"
        aria-valuemin={0}
        aria-valuemax={CARDS.length}
        aria-valuenow={reviewed}
        className="mt-2 h-2 overflow-hidden rounded-full bg-line">

        <span className="block h-full rounded-full bg-accent" style={{ width: `${reviewed / Math.max(1, CARDS.length) * 100}%` }} />
      </div>

      {unreviewed.length === 0 ?
      <p className="mt-6 text-body text-ink2">검토할 카드가 없습니다.</p> :

      <div className="mt-6 space-y-6">
          {GATES.map((gate) => {
          const cards = unreviewed.filter((card) => card.gate === gate.id);
          if (cards.length === 0) return null;
          return (
            <section key={gate.id} aria-label={`${gate.id} ${gate.name}`}>
                <h3 className="text-small font-bold text-ink">
                  {gate.id} {gate.name}
                  <span className="ml-2 font-normal tabular-nums text-ink2">{formatNumber(cards.length)}장</span>
                </h3>
                <ul className="mt-2 divide-y divide-line2 border-y border-line">
                  {cards.map((card) => {
                  // 카드 이름이 곧 카테고리인 카드가 많다. 같으면 한 번만 쓴다
                  const categories = card.categories.map(categoryLabel).join(', ');
                  return (
                    <li key={card.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-24 shrink-0 whitespace-nowrap text-small tabular-nums text-ink2">{card.id}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-small font-bold text-ink">{card.name}</span>
                        {categories && categories.replace(/\s/g, '') !== card.name.replace(/\s/g, '') &&
                        <span className="block text-caption text-ink2">{categories}</span>
                        }
                      </span>
                      {card.verdict &&
                  <span className="hidden shrink-0 sm:block">
                          <VerdictBadge verdict={{ code: card.verdict, label: VERDICT_LABEL[card.verdict] }} />
                        </span>
                  }
                      <a
                    href={cardUrl(card)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-small font-bold text-accent transition-colors duration-150 hover:bg-surface">

                        카드 파일
                        <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only">{card.id} 새 창에서 열기</span>
                      </a>
                    </li>);

                })}
                </ul>
              </section>);

        })}
        </div>
      }
    </div>);

}
