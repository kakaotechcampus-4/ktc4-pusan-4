import { ExternalLinkIcon } from 'lucide-react';
import { statuteOf } from '../mock/statutes';

interface StatuteCitationProps {
  statuteId: string;
  /** 목록에서는 본문을 접고 상세에서만 펼친다 */
  showBody?: boolean;
}

export function StatuteCitation({
  statuteId,
  showBody = true
}: StatuteCitationProps) {
  const statute = statuteOf(statuteId);
  if (!statute) return null;

  const isEvidence = statute.role === 'EVIDENCE';

  return (
    <article
      className={`rounded-xl border bg-surface p-3.5 ${
      isEvidence ? 'border-line' : 'border-dashed border-line'}`
      }>
      
      <header className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-1.5 py-0.5 text-caption font-semibold ${
          isEvidence ?
          'bg-ink text-white' :
          'bg-line2 text-ink2'}`
          }>
          
          {isEvidence ? '근거' : '참고 해석기준'}
        </span>
        <span className="rounded-md border border-line px-1.5 py-0.5 text-caption text-muted">
          {statute.hierarchy}
        </span>
        <h4 className="text-small font-semibold text-ink">{statute.label}</h4>
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
        <span className="inline-flex items-center gap-1 text-accent">
          국가법령정보
          <ExternalLinkIcon className="h-3 w-3" aria-hidden="true" />
        </span>
      </footer>
    </article>);

}