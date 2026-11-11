import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { InboxIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Badge, Button, Empty, FilterBar, Modal, Pagination, SectionHeading, cn } from '../components/ui';
import { SystemMap } from '../components/admin/SystemMap';
import { CandidateImpact } from '../components/admin/CandidateImpact';
import { CardReviews } from '../components/admin/CardReviews';
import { CandidateStats } from '../components/admin/CandidateStats';
import { useDraft } from '../components/admin/useDraft';
import { approveBlock } from '../components/admin/impact';
import { CARDS } from '../rules/cards';
import { useSession } from '../contexts/SessionContext';
import { api, ApiRequestError, useApi } from '../api';
import type { RuleCandidate } from '../types/domain';
import { formatDateTime } from '../utils/format';
import { statuteTitle } from '../utils/statute';

type Filter = 'PENDING' | 'ON_HOLD' | 'APPROVED' | 'REJECTED';

const FILTERS: { value: Filter; label: string }[] = [
{ value: 'PENDING', label: '대기' },
{ value: 'ON_HOLD', label: '보류' },
{ value: 'APPROVED', label: '승인' },
{ value: 'REJECTED', label: '기각' }];


type Decision = 'approve' | 'reject';

/** 아래 판. 규칙 후보, 후보 통계, 카드 검토 대기열 */
type Tab = 'candidates' | 'stats' | 'cards';
const TABS: { value: Tab; label: string }[] = [
{ value: 'candidates', label: '규칙 후보' },
{ value: 'stats', label: '후보 통계' },
{ value: 'cards', label: '카드 검토' }];

const tabId = (tab: Tab) => `admin-tab-${tab}`;
const panelId = (tab: Tab) => `admin-panel-${tab}`;

/** 후보를 부르는 이름. 업종 코드는 관리자가 어느 업종인지 알아야 해서 남긴다 */
const candidateName = (candidate: RuleCandidate) => `${candidate.merchantCategory}(${candidate.industryCode})`;

/**
 * 근거 조문의 제목. 후보는 조문 id 만 준다(소득세법시행령-55-1-7). 법령 이름은 id 앞부분이고,
 * 시행령·시행규칙은 띄어 쓴다 → 소득세법 시행령 제55조 제1항 제7호. 심판례처럼 조가 없는 id 는 그 앞부분만 남는다
 */
const docTitle = (statuteId: string) =>
statuteTitle(statuteId, statuteId.split(/[#-]/)[0].replace(/(시행령|시행규칙)$/, ' $1'));

/**
 * M1 규칙 후보 관리자 화면. 여러 사용자에게서 판정할 규칙이 없던 카테고리·업종 조합과
 * AI 가 만든 규칙 카드 초안을 보고 승인·기각한다. 발표 범위는 조회와 승인·기각까지다(backend_api_plan.md).
 * 계약은 api.md 3.15 다.
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

  const [tab, setTab] = useState<Tab>('candidates');
  const tabsRef = useRef<HTMLDivElement>(null);

  const listQ = useApi(
    () => isAdmin ? api.admin.ruleCandidates.list({ status: filter, page, size: 20 }) : Promise.resolve(null),
    [isAdmin, filter, page]
  );

  // 마지막 쪽의 마지막 후보를 처리하면 그 쪽이 비는데 Pagination 이 사라져 되돌아갈 수 없다
  useEffect(() => {
    if (page > 0 && listQ.data && listQ.data.items.length === 0) setPage(0);
  }, [page, listQ.data]);

  if (!isAdmin) return <Navigate to="/upload" replace />;

  const forbidden = listQ.error instanceof ApiRequestError && listQ.error.status === 403;
  const items = listQ.data?.items ?? [];

  // 취소하면 모달 안의 실패 문구도 지운다. 남기면 모달 밖 문구로 옮겨 붙는다
  const closeModal = () => {
    if (busy) return;
    setPending(null);
    setError(null);
  };

  const decide = async () => {
    if (!pending || busy) return;
    const { candidate, decision } = pending;
    setBusy(true);
    setError(null);
    try {
      const send = decision === 'approve' ? api.admin.ruleCandidates.approve : api.admin.ruleCandidates.reject;
      await send(candidate.id);
      setPending(null);
      setNotice(`${candidateName(candidate)} 후보를 ${decision === 'approve' ? '승인' : '기각'}했습니다.`);
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

  /** 지도의 마디를 누르면 그 판으로 옮기고 탭에 초점을 둔다 */
  const openTab = (next: Tab) => {
    setTab(next);
    window.setTimeout(() => {
      const button = document.getElementById(tabId(next));
      button?.focus({ preventScroll: true });
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
      tabsRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }, 0);
  };

  /** 탭은 화살표로 옮긴다 */
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const index = TABS.findIndex((item) => item.value === tab);
    const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].value;
    setTab(next);
    document.getElementById(tabId(next))?.focus();
  };

  const unreviewed = CARDS.filter((card) => !card.reviewed).length;

  return (
    <AppShell showSteps={false}>
      <div className="mx-auto max-w-5xl">
        <SectionHeading size="page" title="관리자" />

        <div className="mt-6">
          <SystemMap
            onOpenQueue={() => openTab('cards')}
            onOpenCandidates={() => openTab('candidates')} />
        </div>

        <div
          ref={tabsRef}
          role="tablist"
          aria-label="관리자 화면"
          onKeyDown={onTabKey}
          className="mt-10 flex scroll-mt-24 gap-6 border-b border-line">

          {TABS.map((item) => {
            const active = item.value === tab;
            return (
              <button
                key={item.value}
                id={tabId(item.value)}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={active ? panelId(item.value) : undefined}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(item.value)}
                className={cn(
                  '-mb-px border-b-2 pb-3 text-body font-bold transition-colors duration-150',
                  active ? 'border-accent text-ink' : 'border-transparent text-ink2 hover:text-ink'
                )}>

                {item.label}
                {item.value === 'cards' &&
                <span className="ml-1.5 font-normal tabular-nums">{unreviewed.toLocaleString('ko-KR')}</span>
                }
              </button>);

          })}
        </div>

        {tab === 'stats' &&
        <div id={panelId('stats')} role="tabpanel" aria-labelledby={tabId('stats')} className="mt-6">
            <CandidateStats />
          </div>
        }
        {tab === 'stats' ? null : tab === 'cards' ?
        <div id={panelId('cards')} role="tabpanel" aria-labelledby={tabId('cards')} className="mt-6">
            <CardReviews />
          </div> :

        <div id={panelId('candidates')} role="tabpanel" aria-labelledby={tabId('candidates')}>
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
          tone="error"
          icon={<InboxIcon className="h-5 w-5" />}
          title="후보를 불러오지 못했습니다"
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

        {/* 목록을 못 읽었으면 전에 읽은 쪽 번호를 띄우지 않는다 */}
        {!listQ.error && listQ.data && listQ.data.page.totalPages > 1 &&
        <Pagination page={listQ.data.page} onChange={setPage} />
        }

        <Modal
          open={pending !== null}
          onClose={closeModal}
          tone={pending?.decision === 'reject' ? 'danger' : 'neutral'}
          title={
          pending ?
          `${candidateName(pending.candidate)} 후보를 ${pending.decision === 'approve' ? '승인' : '기각'}할까요?` :
          ''
          }
          description="처리한 후보는 다시 대기로 돌릴 수 없습니다."
          footer={
          <>
              <Button variant="secondary" size="md" disabled={busy} onClick={closeModal}>
                취소
              </Button>
              <Button
              variant={pending?.decision === 'reject' ? 'danger' : 'primary'}
              size="md"
              disabled={busy}
              onClick={() => void decide()}>

                {busy ? '처리 중' : pending?.decision === 'approve' ? '승인' : '기각'}
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
        <p role="alert" className="mt-3 text-small text-deny">
            {error}
          </p>
        }
        </div>
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
  const draft = useDraft(candidate.draftYaml);
  /** 법령 인용이 없거나 초안이 없으면 승인을 막는다. 초안을 못 읽은 것은 알리기만 한다 */
  const block = approveBlock(draft);
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-canvas">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line2 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{candidate.status.label}</Badge>
            <span className="text-caption tabular-nums text-muted">업종 {candidate.industryCode}</span>
          </div>
          <h2 className="mt-2 text-h4 font-bold text-ink">{candidate.merchantCategory}</h2>
        </div>
        {open &&
        <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={disabled} onClick={() => onDecide('reject')}>
                기각
              </Button>
              <Button
              size="sm"
              disabled={disabled || block !== null}
              aria-describedby={block && candidate.draftYaml !== null ? `block-${candidate.id}` : undefined}
              onClick={() => onDecide('approve')}>
                승인
              </Button>
            </div>
            {/* 초안이 없는 것은 아래 문장이 이미 말한다 */}
            {block && candidate.draftYaml !== null && draft.status !== 'loading' &&
          <p id={`block-${candidate.id}`} className="max-w-56 text-right text-caption text-deny">
                {block}
              </p>
          }
          </div>
        }
      </header>

      <div className="space-y-3 px-5 py-4">
        <div>
          <h3 className="text-small font-bold text-ink">근거</h3>
          {candidate.suggestedDocs.length > 0 ?
          <ul className="mt-2 space-y-2">
              {candidate.suggestedDocs.map((doc) =>
            <li key={doc.statuteId} className="rounded-xl border border-line px-3.5 py-3">
                  <p className="text-small">
                    <span className="font-bold text-ink">{docTitle(doc.statuteId)}</span>
                    {doc.tier && <span className="ml-2 text-caption text-muted">{doc.tier}</span>}
                  </p>
                  <blockquote className="mt-1 text-small leading-6 text-ink2">{doc.quote}</blockquote>
                </li>
            )}
            </ul> :

          <p className="mt-1.5 text-small text-ink2">붙은 근거가 없습니다.</p>
          }
        </div>

        <CandidateImpact candidate={candidate} draft={draft} />

        {candidate.draftYaml ?
        <details>
            <summary className="cursor-pointer text-small font-bold text-ink">규칙 카드 초안</summary>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-line p-3.5 text-caption leading-5 text-ink2">
              {candidate.draftYaml}
            </pre>
          </details> :

        <p className="text-small text-ink2">초안을 만들지 못했습니다. 승인할 수 없고 기각만 할 수 있습니다.</p>
        }

        {candidate.reviewedAt &&
        <p className="text-caption tabular-nums text-muted">
            {candidate.reviewedBy ?? '알 수 없음'}, {formatDateTime(candidate.reviewedAt)} 처리
          </p>
        }
      </div>
    </section>);

}
