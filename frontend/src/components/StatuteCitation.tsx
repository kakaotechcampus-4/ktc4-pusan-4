import { ExternalLinkIcon } from 'lucide-react';
import { statuteOf } from '../mock/statutes';

interface StatuteCitationProps {
  statuteVersionId: number;
  /** 목록에서는 본문을 접고 상세에서만 펼친다 */
  showBody?: boolean;
}

/** 판정 근거 조문 1건. GET /statutes/{statuteVersionId} 응답을 그대로 보여준다. */
export function StatuteCitation({
  statuteVersionId,
  showBody = true
}: StatuteCitationProps) {
  const statute = statuteOf(statuteVersionId);
  if (!statute) return null;

  return (
    <article className="rounded-xl border border-line bg-surface p-3.5">
      <header>
        <h4 className="text-small font-semibold text-ink">{statute.title}</h4>
      </header>

      {showBody &&
      <p className="mt-2 text-small leading-6 text-ink2">{statute.body}</p>
      }

      <footer className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption tabular-nums text-muted">
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
