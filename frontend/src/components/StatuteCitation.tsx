import { ExternalLinkIcon } from 'lucide-react';
import { api, useApi } from '../api';
import type { StatuteHierarchy } from '../types/domain';
import { Badge } from './ui/Badge';
import { cn } from './ui/cn';

interface StatuteCitationProps {
  statuteVersionId: number;
  /** 목록에서는 본문을 접고 상세에서만 펼친다 */
  showBody?: boolean;
}

interface Tier {
  label: string;
  /** 법령이면 true. 참고는 바탕을 낮춰 법령과 같은 무게로 읽히지 않게 한다 */
  binding: boolean;
  note?: string;
}

/**
 * 근거 위계 (CONTEXT.md §6). 나누지 않으면 사용자가 판례·예규를 법령과 같은 무게로 읽는다.
 * 법령만 「근거」이고, 국세청 해석기준과 개별 사건 판단은 「참고」로 낮춰 보여준다.
 * 고시는 위임 고시처럼 구속력이 있는 것도 있어 「구속력 없음」을 단정하지 않는다.
 */
const TIER: Record<StatuteHierarchy, Tier> = {
  법률: { label: '근거', binding: true },
  시행령: { label: '근거', binding: true },
  시행규칙: { label: '근거', binding: true },
  기본통칙: { label: '참고 해석기준', binding: false, note: '국세청 해석기준이며 법적 구속력은 없습니다' },
  고시: { label: '참고 해석기준', binding: false },
  예규: { label: '참고 해석기준', binding: false, note: '국세청 해석기준이며 법적 구속력은 없습니다' },
  심판례: { label: '참고 사례', binding: false, note: '개별 사건의 판단입니다' },
  판례: { label: '참고 사례', binding: false, note: '개별 사건의 판단입니다' }
};

/** 위 목록에 없는 위계(훈령·해석례 등)는 근거로 올리지 않고 참고로 낮춘다 */
const tierOf = (hierarchy: string): Tier =>
TIER[hierarchy as StatuteHierarchy] ?? { label: `참고 (${hierarchy})`, binding: false };

/** 판정 근거 조문 1건. GET /statutes/{statuteVersionId} 응답을 그대로 보여준다. */
export function StatuteCitation({
  statuteVersionId,
  showBody = true
}: StatuteCitationProps) {
  const { data: statute, error, loading, reload } = useApi(
    () => api.statutes.get(statuteVersionId),
    [statuteVersionId]
  );
  // 불러오지 못한 조문을 조용히 빼면 근거가 없는 판정처럼 보인다. 실패는 오류 상자로 알린다.
  // 다시 시도하는 동안에는 골격을 보여 버튼이 눌렸음을 알린다
  if (error && !loading)
  return (
    <p role="alert" className="rounded-xl border border-deny-line bg-deny-bg p-3.5 text-small text-deny">
        조문을 불러오지 못했습니다 (버전 #{statuteVersionId}).{' '}
        <button type="button" onClick={reload} className="font-semibold underline">
          다시 시도
        </button>
      </p>);

  if (!statute) return <span className="block h-16 animate-pulse rounded-xl bg-line2" />;

  const tier = tierOf(statute.hierarchy);
  const binding = tier.binding;

  return (
    <article
      className={cn(
        'rounded-xl border border-line p-3.5',
        binding ? 'bg-surface' : 'bg-canvas'
      )}>

      <header className="flex flex-wrap items-center gap-2">
        <Badge tone={binding ? 'ink' : 'neutral'}>{tier.label}</Badge>
        <h4 className="text-small font-semibold text-ink">{statute.title}</h4>
      </header>

      {showBody &&
      <p className="mt-2 text-small leading-6 text-ink2">{statute.body}</p>
      }

      <footer className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption tabular-nums text-muted">
        {tier.note && <span>{tier.note}</span>}
        <span>
          시행 {statute.effectiveFrom}
          {statute.effectiveTo ? ` – ${statute.effectiveTo}` : ' – 현행'}
        </span>
        <span>버전 #{statute.statuteVersionId}</span>
        <a
          href={statute.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-accent hover:underline">

          국가법령정보
          <ExternalLinkIcon className="h-3 w-3" aria-hidden="true" />
        </a>
      </footer>
    </article>);

}
