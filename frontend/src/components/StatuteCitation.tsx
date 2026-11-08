import { ExternalLinkIcon } from 'lucide-react';
import { api, ApiRequestError, useApi } from '../api';
import type { StatuteHierarchy } from '../types/domain';
import { formatFullDate } from '../utils/format';
import { lawGoKrUrl, statuteTitle } from '../utils/statute';
import { Badge } from './ui/Badge';

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
  // 불러오지 못한 조문을 조용히 빼면 근거가 없는 판정처럼 보인다. 조문 자리에 실패를 남긴다.
  // 없는 버전(3.13 STATUTE_NOT_FOUND)은 다시 시도해도 같으니 버튼을 두지 않는다
  if (error instanceof ApiRequestError && error.code === 'STATUTE_NOT_FOUND')
  return (
    <p role="alert" className="rounded-xl border border-line p-3.5 text-small text-deny">
        이 조문을 찾을 수 없습니다.
      </p>);

  // 다시 시도하는 동안에는 골격을 보여 버튼이 눌렸음을 알린다
  if (error && !loading)
  return (
    <p role="alert" className="rounded-xl border border-line p-3.5 text-small text-deny">
        조문을 불러오지 못했습니다.{' '}
        <button type="button" onClick={reload} className="py-1 font-bold underline">
          다시 시도
        </button>
      </p>);

  if (!statute) return <span className="block h-16 animate-pulse rounded-xl bg-line2" />;

  const tier = tierOf(statute.hierarchy);

  // 법령과 참고는 배지로 가른다. 바탕은 둘 다 흰색이다
  return (
    <article className="rounded-xl border border-line p-3.5">
      <header className="flex flex-wrap items-center gap-2">
        <Badge tone={tier.binding ? 'ink' : 'neutral'}>{tier.label}</Badge>
        {/* 서버 제목은 법령 이름뿐이라 조·항·호를 붙인다 (C8) */}
        <h4 className="text-small font-bold text-ink">{statuteTitle(statute.statuteId, statute.title)}</h4>
      </header>

      {/*
        본문은 접어 둔다. 판정 하나에 조문이 여러 개 붙으면 상세 패널이 본문으로 꽉 차서
        무슨 조문이 걸렸는지부터 안 보인다 (#242 리뷰). 제목·시행일·원문 링크는 늘 보이니
        「근거까지 보여준다」는 약속은 그대로다. details 라 키보드와 스크린리더가 그냥 된다
      */}
      {showBody &&
      <details className="mt-2">
          {/* 좁은 화면에서도 누를 자리가 24px 을 넘게 위아래 여백을 준다 (C82) */}
          <summary className="cursor-pointer py-1 text-caption font-bold text-ink2 hover:text-ink">
            조문 보기
          </summary>
          <p className="mt-2 text-small leading-6 text-ink2">{statute.body}</p>
        </details>
      }

      {tier.note && <p className="mt-2 text-caption text-ink2">{tier.note}</p>}
      <footer className="mt-1 flex flex-wrap items-center gap-x-3 text-caption tabular-nums text-muted">
        <span>
          시행 {formatFullDate(statute.effectiveFrom)}
          {statute.effectiveTo ? ` ~ ${formatFullDate(statute.effectiveTo)}` : ' ~ 현행'}
        </span>
        {/* 말뭉치가 쌓아 둔 …/제81의6조 꼴은 law.go.kr 이 열지 못한다 (C9) */}
        <a
          href={lawGoKrUrl(statute.sourceUrl)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 py-1 text-accent hover:underline">

          국가법령정보
          <ExternalLinkIcon className="h-3 w-3" aria-hidden="true" />
        </a>
      </footer>
    </article>);

}
