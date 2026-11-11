import { ArrowRightIcon } from 'lucide-react';
import evalCases from 'virtual:eval-cases';
import type { RuleCandidate, Verdict } from '../../types/domain';
import { VerdictBadge } from '../VerdictBadge';
import { VERDICT_LABEL } from '../../utils/verdict';
import { formatNumber } from '../../utils/format';
import { authorityOf, citationProblem, overlappingCases, type DraftState } from './impact';

const coded = (code: Verdict) => ({ code, label: VERDICT_LABEL[code] });

/** 초안이 인용한 위계를 한 번씩, 법률부터 */
const ORDER = ['법률', '시행령', '시행규칙'] as const;

/**
 * 승인 전 영향 보기의 화면 몫(todo/README.md 5장). 서버가 초안을 넣고 다시 판정해 보는 몫은 아직 없다.
 * - 초안의 인용에 법률, 시행령, 시행규칙이 하나도 없으면 승인을 막는다(막는 것은 Admin 이 한다). 못 읽으면 알리기만 한다
 * - 규칙이 없어 확인 필요가 된 판정 수는 후보가 쌓아 온 누적이다. 지금 판정은 다시 판정해야 초안을 따른다
 * - 업종과 카테고리가 겹치는 평가 사례를 기대 판정과 초안 판정으로 나란히 둔다
 */
export function CandidateImpact({ candidate, draft }: {candidate: RuleCandidate;draft: DraftState;}) {
  const cases = overlappingCases(candidate, evalCases);
  const draftVerdict = draft.status === 'ok' ? draft.card.verdict : null;
  const authorities =
  draft.status === 'ok' ?
  ORDER.filter((tier) => draft.card.citations.some((id) => authorityOf(id) === tier)) :
  [];

  return (
    <section aria-label="승인 전 영향" className="rounded-xl border border-line px-4 py-3.5">
      <h3 className="text-small font-bold text-ink">승인 전 영향</h3>

      <p className="mt-2 text-small tabular-nums text-ink">
        규칙이 없어 확인 필요가 된 판정 {formatNumber(candidate.occurrenceCount)}건(누적), 사용자{' '}
        {formatNumber(candidate.distinctUsers)}명
      </p>
      <p className="mt-0.5 text-small text-ink2">지금 판정은 다시 판정해야 초안을 따릅니다.</p>

      {draft.status === 'ok' &&
      <p className="mt-2 text-small">
          {citationProblem(draft.card.citations) ?
        <b className="text-deny">{citationProblem(draft.card.citations)}</b> :
        <span className="text-ink">규칙 카드 초안이 {authorities.join(', ')} 조문을 인용합니다.</span>
        }
        </p>
      }
      {draft.status === 'error' &&
      <p role="status" className="mt-2 text-small text-ink">
          초안을 읽지 못해 인용과 판정을 확인하지 못했습니다.
        </p>
      }

      <div className="mt-3">
        <h4 className="flex items-baseline justify-between gap-3 text-small font-bold text-ink">
          겹치는 평가 사례
          {cases.length > 0 && <span className="text-caption font-normal text-ink2">기대 판정, 초안 판정</span>}
        </h4>
        {cases.length === 0 ?
        <p className="mt-1 text-small text-ink2">업종과 카테고리가 같은 평가 사례가 없습니다.</p> :

        <ul className="mt-1.5 divide-y divide-line2">
            {cases.map((item) =>
          <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2 text-small">
                <span className="min-w-0 flex-1">
                  <span className="mr-2 tabular-nums text-ink2">{item.id}</span>
                  <span className="text-ink">{item.title}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="sr-only">기대 판정</span>
                  <VerdictBadge verdict={coded(item.expected)} />
                  <ArrowRightIcon className="h-3.5 w-3.5 text-ink2" aria-hidden="true" />
                  <span className="sr-only">초안 판정</span>
                  {draftVerdict ?
              <VerdictBadge verdict={coded(draftVerdict)} /> :

              <span className="text-caption text-ink2">{draft.status === 'ok' ? '판정 없음' : '모름'}</span>
              }
                </span>
              </li>
          )}
          </ul>
        }
      </div>
    </section>);

}
