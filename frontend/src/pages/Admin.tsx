import { useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { InboxIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Badge, Button, Empty, FilterBar, Modal, Pagination, SectionHeading } from '../components/ui';
import type { BadgeTone } from '../components/ui';
import { useSession } from '../contexts/SessionContext';
import { api, ApiRequestError, useApi } from '../api';
import type { RuleCandidate, RuleCandidateStatus } from '../types/domain';
import { formatDateTime, formatNumber } from '../utils/format';

type Filter = 'PENDING' | 'ON_HOLD' | 'APPROVED' | 'REJECTED';

const FILTERS: { value: Filter; label: string }[] = [
{ value: 'PENDING', label: '대기' },
{ value: 'ON_HOLD', label: '보류' },
{ value: 'APPROVED', label: '승인' },
{ value: 'REJECTED', label: '기각' }];


const STATUS_TONE: Record<RuleCandidateStatus, BadgeTone> = {
  PENDING: 'warn',
  IN_REVIEW: 'warn',
  ON_HOLD: 'neutral',
  APPROVED: 'ok',
  REJECTED: 'deny'
};

type Decision = 'approve' | 'reject';

/**
 * M1 규칙 후보 관리자 화면. 여러 사용자에게서 판정할 규칙이 없던 카테고리·업종 조합과
 * AI 가 만든 규칙 카드 초안을 보고 승인·기각한다. 발표 범위는 조회와 승인·기각까지다(backend_api_plan.md).
 * 관리자 API 계약은 아직 없다 — 모양은 rule_candidate 테이블을 따른 가정이다.
 */
export function Admin() {
  const { isAdmin } = useSession();
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState<{ candidate: RuleCandidate; decision: Decision } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  const listQ = useApi(
    () => isAdmin ? api.admin.ruleCandidates.list({ status: filter, page, size: 20 }) : Promise.resolve(null),
    [isAdmin, filter, page]
  );

  if (!isAdmin) return <Navigate to="/upload" replace />;

  const forbidden = listQ.error instanceof ApiRequestError && listQ.error.status === 403;
  const items = listQ.data?.items ?? [];

  const decide = async () => {
    if (!pending || busy) return;
    const { candidate, decision } = pending;
    setBusy(true);
    setError(null);
    try {
      const send = decision === 'approve' ? api.admin.ruleCandidates.approve : api.admin.ruleCandidates.reject;
      await send(candidate.id);
      setPending(null);
      setNotice(
        `${candidate.merchantCategory} · ${candidate.industryCode} 후보를 ${decision === 'approve' ? '승인' : '기각'}했습니다.`
      );
      window.setTimeout(() => noticeRef.current?.focus(), 0);
      listQ.reload();
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError && caught.status === 409 ?
        '이미 처리한 후보입니다. 목록을 다시 불러왔습니다.' :
        '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
      if (caught instanceof ApiRequestError && caught.status === 409) {
        setPending(null);
        listQ.reload();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell showSteps={false}>
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          eyebrow="관리자"
          title="규칙 후보"
          description="여러 사용자에게서 판정할 규칙이 없던 카테고리·업종입니다. 초안과 근거를 보고 승인하거나 기각합니다. 처리하면 검토한 사람과 시각이 남습니다." />

        <FilterBar
          className="mt-6"
          name="후보 상태"
          value={filter}
          onChange={(next) => {
            setFilter(next);
            setPage(0);
            setNotice('');
          }}
          options={FILTERS} />

        {filter === 'ON_HOLD' &&
        <p className="mt-3 text-small text-muted">
            보류는 초안을 만들지 못했거나 근거가 모자란 후보입니다. 보류 사유는 아직 저장되지 않습니다.
          </p>
        }

        <p
          ref={noticeRef}
          role="status"
          tabIndex={-1}
          className={notice ? 'mt-3 text-small text-ink2 outline-none' : 'sr-only'}>

          {notice}
        </p>

        {forbidden ?
        <Empty
          className="mt-4"
          icon={<InboxIcon className="h-5 w-5" />}
          title="관리자만 볼 수 있습니다"
          description="관리자 계정으로 로그인해 주세요." /> :

        listQ.error ?
        <Empty
          className="mt-4"
          icon={<InboxIcon className="h-5 w-5" />}
          title="후보를 불러오지 못했습니다"
          description="잠시 후 다시 시도해 주세요."
          action={
          <Button size="sm" variant="secondary" onClick={listQ.reload}>
                다시 시도
              </Button>
          } /> :

        !listQ.loading && items.length === 0 ?
        <Empty
          className="mt-4"
          icon={<InboxIcon className="h-5 w-5" />}
          title={`${FILTERS.find((option) => option.value === filter)?.label} 후보가 없습니다`} /> :

        <ul className="mt-4 space-y-3">
            {items.map((candidate) =>
          <li key={candidate.id}>
                <CandidateCard
              candidate={candidate}
              disabled={busy}
              onDecide={(decision) => {
                setError(null);
                setPending({ candidate, decision });
              }} />

              </li>
          )}
          </ul>
        }

        {listQ.data && listQ.data.page.totalPages > 1 &&
        <Pagination page={listQ.data.page} onChange={setPage} />
        }

        <Modal
          open={pending !== null}
          onClose={() => !busy && setPending(null)}
          tone={pending?.decision === 'reject' ? 'danger' : 'neutral'}
          title={
          pending ?
          `${pending.candidate.merchantCategory} · ${pending.candidate.industryCode} 후보를 ${
          pending.decision === 'approve' ? '승인' : '기각'}할까요?` :
          ''
          }
          description="처리한 후보는 다시 대기로 돌릴 수 없습니다."
          footer={
          <>
              <Button variant="secondary" size="md" disabled={busy} onClick={() => setPending(null)}>
                취소
              </Button>
              <Button
              variant={pending?.decision === 'reject' ? 'danger' : 'primary'}
              size="md"
              disabled={busy}
              onClick={() => void decide()}>

                {busy ? '처리 중…' : pending?.decision === 'approve' ? '승인' : '기각'}
              </Button>
            </>
          }>

          {error &&
          <p role="alert" className="text-small text-deny">
              {error}
            </p>
          }
        </Modal>
        {error && pending === null &&
        <p role="alert" className="mt-3 rounded-xl border border-deny-line bg-deny-bg px-4 py-3 text-small text-deny">
            {error}
          </p>
        }
      </div>
    </AppShell>);

}

interface CandidateCardProps {
  candidate: RuleCandidate;
  disabled: boolean;
  onDecide: (decision: Decision) => void;
}

function CandidateCard({ candidate, disabled, onDecide }: CandidateCardProps) {
  const open = candidate.status.code === 'PENDING' || candidate.status.code === 'ON_HOLD';
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line2 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[candidate.status.code]}>{candidate.status.label}</Badge>
            <span className="text-caption tabular-nums text-muted">업종 {candidate.industryCode}</span>
          </div>
          <h2 className="mt-2 text-h4 font-semibold text-ink">{candidate.merchantCategory}</h2>
          <p className="mt-0.5 text-caption tabular-nums text-muted">
            사용자 {formatNumber(candidate.distinctUsers)}명 · {formatNumber(candidate.occurrenceCount)}건 · 만든 시각{' '}
            {formatDateTime(candidate.createdAt)}
          </p>
        </div>
        {open &&
        <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" disabled={disabled} onClick={() => onDecide('reject')}>
              기각
            </Button>
            <Button size="sm" disabled={disabled || candidate.draftYaml === null} onClick={() => onDecide('approve')}>
              승인
            </Button>
          </div>
        }
      </header>

      <div className="space-y-3 px-5 py-4">
        <div>
          <h3 className="text-small font-semibold text-ink">
            근거{candidate.searchedTier && <span className="ml-1.5 font-normal text-muted">가장 위 위계 {candidate.searchedTier}</span>}
          </h3>
          {candidate.suggestedDocs.length > 0 ?
          <ul className="mt-2 space-y-2">
              {candidate.suggestedDocs.map((doc) =>
            <li key={doc.statuteId} className="rounded-xl border border-line bg-canvas px-3.5 py-3">
                  <p className="text-caption tabular-nums text-muted">
                    {doc.statuteId}
                    {doc.tier && ` · ${doc.tier}`}
                  </p>
                  <blockquote className="mt-1 text-small leading-6 text-ink2">{doc.quote}</blockquote>
                </li>
            )}
            </ul> :

          <p className="mt-1.5 text-small text-muted">붙은 근거가 없습니다.</p>
          }
        </div>

        {candidate.draftYaml ?
        <details>
            <summary className="cursor-pointer text-small font-semibold text-ink">규칙 카드 초안</summary>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-canvas p-3.5 text-caption leading-5 text-ink2">
              {candidate.draftYaml}
            </pre>
          </details> :

        <p className="text-small text-muted">초안을 만들지 못했습니다. 승인할 수 없고 기각만 할 수 있습니다.</p>
        }

        {candidate.reviewedAt &&
        <p className="text-caption tabular-nums text-muted">
            {candidate.reviewedBy ?? '알 수 없음'} · {formatDateTime(candidate.reviewedAt)} 처리
          </p>
        }
      </div>
    </section>);

}
