import { useEffect, useRef, useState } from 'react';
import { DownloadIcon, Loader2Icon, SearchXIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { JudgmentDetailPanel } from '../components/results/JudgmentDetailPanel';
import { AmountHero } from '../components/results/AmountHero';
import { AccountBreakdown } from '../components/results/AccountBreakdown';
import { JudgmentAmount } from '../components/results/JudgmentAmount';
import { categoryLabel, merchantTitle, verdictNote } from '../components/results/display';
import { VerdictBadge } from '../components/VerdictBadge';
import { BottomSheet, Button, Empty, FilterBar, IconButton, Pagination, Table, type Column } from '../components/ui';
import { useAssistantSubject } from '../components/assistant/context';
import { api, useApi } from '../api';
import { readAll } from '../api/readAll';
import type { Judgment, UploadBatch } from '../types/domain';
import { formatFullDate } from '../utils/format';
import { sharesOf, spendOf } from '../utils/shares';
import { AWAITING_ANSWER, verdictFilterQuery, type VerdictFilter } from '../utils/verdict';
import { download, judgmentsCsv } from '../utils/csv';
import { exceededLimitOf, limitLine, limitsOf, PROVISIONAL_NOTE } from '../utils/limit';
import { useMediaQuery } from '../hooks/useMediaQuery';

const PAGE_SIZE = 20;

/** 결과 화면과 같은 상세 상자 스크롤 (Results.tsx PANEL_SCROLL) */
const PANEL_SCROLL =
'max-h-[calc(100vh-16.5rem)] overflow-y-auto [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted/40 [&::-webkit-scrollbar]:w-2';

/** 올린 카드내역 기간이 걸친 해. 최근 해가 앞이다. 12월과 1월을 같이 올리면 두 해다 */
const yearsOf = (batches: UploadBatch[]) => {
  const years = new Set<number>();
  for (const batch of batches) {
    const to = Number(batch.periodEnd.slice(0, 4));
    for (let year = Number(batch.periodStart.slice(0, 4)); year <= to; year += 1) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
};

const head = (text: string) => <span className="whitespace-nowrap">{text}</span>;

/**
 * 한 해 전체의 판정 결과. 결과와 요약은 올린 파일 하나만 보여서, 카드를 여러 장 올리면 그해를 합쳐 볼 곳이 없었다.
 * 신고는 해마다 하므로 year 로 읽는다(api.md 3.7). 접대비 한도는 year 집계에서만 경비 가능 금액에 반영된다.
 * 표는 결과 화면처럼 한 쪽씩 서버에서 받고, 건수와 금액은 요약에서 받는다. 한 해는 수천 건이라 전부 읽지 않는다.
 * CSV 는 누를 때 내보내기(현재 판정 전부)를 읽는다
 */
export function Yearly() {
  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const [filter, setFilter] = useState<VerdictFilter>('ALL');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  useAssistantSubject(selectedId);
  const wide = useMediaQuery('(min-width: 1024px)');

  const uploadsQ = useApi(() => readAll((page, size) => api.uploads.list({ page, size })), []);
  const years = uploadsQ.data ? yearsOf(uploadsQ.data) : [];
  const year = pickedYear !== null && years.includes(pickedYear) ? pickedYear : years[0] ?? null;

  // 해를 바꾸면 다시 읽는 동안 앞 해의 응답이 남아 있다. 어느 해의 것인지 붙여 고른 해의 것만 그린다
  const summaryQ = useApi(
    () => year ? api.judgments.summary({ year }).then((data) => ({ year, data })) : Promise.resolve(null),
    [year]
  );
  // 표의 한 쪽. 서버가 필터로 거르고 승인일 최근 순으로 세워 준다. 해를 바꾸는 동안 앞 해의 쪽은 그리지 않는다
  const listQ = useApi(
    () =>
    year ?
    api.judgments.
    list({ year, ...verdictFilterQuery(filter), sort: 'APPROVED_AT', page, size: PAGE_SIZE }).
    then((data) => ({ year, data })) :
    Promise.resolve(null),
    [year, filter, page]
  );
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);

  const summary = summaryQ.data?.year === year ? summaryQ.data.data : null;
  const listed = listQ.data?.year === year ? listQ.data.data : null;
  const limits = summary?.limits ?? [];
  const awaitingCount = summary?.awaiting.count ?? 0;
  const judgments: Judgment[] = listed?.items ?? [];
  const listPage = listed?.page;

  const panelQ = useApi(
    () => {
      if (!selectedId) return Promise.resolve(null);
      const id = selectedId;
      return api.judgments.
      list({ transactionId: id }).
      then((page) => ({ id, failed: false as const, judgment: page.items[0] ?? null })).
      catch(() => ({ id, failed: true as const }));
    },
    [selectedId]
  );
  const panelData = panelQ.data?.id === selectedId ? panelQ.data : null;

  /** 방금 판정 대상에서 뺀 거래. 목록을 다시 읽는 동안 첫 행 자동 선택이 그 거래를 다시 고르지 않게 한다 */
  const excludedId = useRef<string | null>(null);
  const firstId = judgments.find((judgment) => judgment.transactionId !== excludedId.current)?.transactionId;
  useEffect(() => {
    if (wide && !selectedId && firstId) setSelectedId(firstId);
  }, [wide, selectedId, firstId]);
  useEffect(() => {
    if (!wide) setSelectedId(null);
  }, [wide]);

  const pageEmpty = Boolean(listed) && judgments.length === 0;
  useEffect(() => {
    if (page > 0 && pageEmpty) setPage(0);
  }, [page, pageEmpty]);

  const select = (transactionId: string) => {
    setSelectedId(transactionId);
    setFocusKey((key) => key + 1);
  };

  const changed = () => {
    summaryQ.reload();
    listQ.reload();
    panelQ.reload();
  };

  const excluded = () => {
    excludedId.current = selectedId;
    setSelectedId(null);
    changed();
  };

  const pickYear = (next: number) => {
    setPickedYear(next);
    setPage(0);
    setSelectedId(null);
  };

  const exportCsv = async () => {
    if (!year || exporting) return;
    setExporting(true);
    setExportFailed(false);
    try {
      const { items, limits: exportLimits } = await api.judgments.export({ year });
      download(`PreeT-판정결과-${year}.csv`, judgmentsCsv(items, exportLimits));
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };

  const filters = [
  { value: 'ALL' as const, label: '전체', count: summary?.totalCount },
  { value: 'AVAILABLE' as const, label: '가능', count: summary?.byVerdict.AVAILABLE.count },
  { value: 'NEEDS_REVIEW' as const, label: '확인 필요', count: summary?.byVerdict.NEEDS_REVIEW.count },
  {
    value: 'UNAVAILABLE' as const,
    label: '불가',
    count: summary ? summary.byVerdict.UNAVAILABLE.count - awaitingCount : undefined
  },
  ...(awaitingCount > 0 || filter === 'AWAITING' ?
  [{ value: 'AWAITING' as const, label: AWAITING_ANSWER, count: awaitingCount }] :
  [])];

  const yearLimits = limitsOf(limits);
  const firstLoad = Boolean(year) && (!summary && !summaryQ.error || !listed && !listQ.error);

  const columns: Column<Judgment>[] = [
  {
    header: head('승인일'),
    width: 'w-[7.5rem]',
    hideBelow: 'sm',
    cell: (row) =>
    <span className="whitespace-nowrap tabular-nums text-ink2">{formatFullDate(row.transaction.approvedAt)}</span>

  },
  {
    header: head('가맹점'),
    width: 'w-full max-w-0',
    cell: (row) => {
      const { transaction } = row;
      return (
        <span className="block min-w-0">
            <span className="block truncate font-normal text-ink">{merchantTitle(transaction)}</span>
            <span className="block whitespace-nowrap text-small tabular-nums text-muted sm:hidden">
              {formatFullDate(transaction.approvedAt)}
            </span>
            <span className="block truncate text-small text-ink2">
              {categoryLabel(transaction.merchantCategory)}
              {transaction.installmentMonths > 0 && `, ${transaction.installmentMonths}개월 할부`}
            </span>
            {/* 계정과목 열은 좁은 화면에서 숨기므로 여기로 옮긴다 */}
            {row.accountLabel && <span className="block truncate text-small text-ink2 md:hidden">{row.accountLabel}</span>}
          </span>);

    }
  },
  {
    header: head('계정과목'),
    width: 'w-32',
    hideBelow: 'md',
    cell: (row) =>
    row.accountLabel ?
    <span className="whitespace-nowrap text-ink2">{row.accountLabel}</span> :
    <span className="text-muted">—</span>

  },
  {
    header: head('금액'),
    align: 'right',
    cell: (row) => <JudgmentAmount row={row} limits={limits} />
  },
  {
    header: head('판정'),
    align: 'right',
    cell: (row) => {
      const note = verdictNote(row, row.awaitingAnswer);
      return (
        <span className="inline-flex flex-col items-end gap-1">
            <VerdictBadge verdict={row.verdict} />
            {note && <span className="whitespace-nowrap text-caption text-ink2">{note}</span>}
          </span>);

    }
  }];


  const header =
  <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-h2 font-bold tracking-tight text-ink">연간 결과</h1>
        {years.length > 0 && year &&
      <FilterBar
        className="mt-3"
        name="연도"
        value={String(year)}
        onChange={(next) => pickYear(Number(next))}
        options={years.map((option) => ({ value: String(option), label: `${option}년` }))} />

      }
      </div>
      {summary && summary.totalCount > 0 &&
    <div className="flex flex-col items-end gap-1">
          <IconButton
        icon={exporting ? Loader2Icon : DownloadIcon}
        spin={exporting}
        label={exporting ? 'CSV 만드는 중' : 'CSV 내려받기'}
        busy={exporting}
        onClick={() => void exportCsv()} />
          {exportFailed &&
      <p role="alert" className="text-small text-deny">
              CSV를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.
            </p>
      }
        </div>
    }
    </header>;


  const pageEmptyState =
  uploadsQ.error ?
  <Empty
    tone="error"
    icon={<SearchXIcon className="h-5 w-5" />}
    title="올린 카드내역을 불러오지 못했습니다"
    action={
    <Button size="sm" variant="secondary" onClick={uploadsQ.reload}>
          다시 시도
        </Button>
    } /> :

  uploadsQ.data && years.length === 0 ?
  <Empty
    icon={<SearchXIcon className="h-5 w-5" />}
    title="올린 카드내역이 없습니다"
    action={
    <Button to="/upload" size="sm" variant="secondary">
          카드내역 올리기
        </Button>
    } /> :

  summaryQ.error || listQ.error ?
  <Empty
    tone="error"
    icon={<SearchXIcon className="h-5 w-5" />}
    title="판정 결과를 불러오지 못했습니다"
    action={
    <Button
      size="sm"
      variant="secondary"
      onClick={() => {
        summaryQ.reload();
        listQ.reload();
      }}>

          다시 시도
        </Button>
    } /> :

  summary?.totalCount === 0 ?
  <Empty
    icon={<SearchXIcon className="h-5 w-5" />}
    title={`${year}년에 판정한 거래가 없습니다`}
    action={
    <Button to="/uploads" size="sm" variant="secondary">
          업로드 이력
        </Button>
    } /> :

  null;

  if (pageEmptyState || uploadsQ.loading && !uploadsQ.data)
  return (
    <AppShell>
        {header}
        {pageEmptyState ?
      <div className="mt-6">{pageEmptyState}</div> :
      <span className="mt-6 block h-64 animate-pulse rounded-2xl bg-surface" />}
      </AppShell>);


  const empty =
  filter === 'NEEDS_REVIEW' ?
  <Empty icon={<SearchXIcon className="h-5 w-5" />} inTable title="확인이 필요한 거래가 없습니다" /> :

  filter === 'AWAITING' ?
  <Empty icon={<SearchXIcon className="h-5 w-5" />} inTable title="답을 기다리는 거래가 없습니다" /> :

  <Empty icon={<SearchXIcon className="h-5 w-5" />} inTable title="이 판정에 해당하는 거래가 없습니다" />;


  const panel =
  panelData && !panelData.failed && panelData.judgment ?
  <JudgmentDetailPanel
    key={selectedId}
    judgment={panelData.judgment}
    exceededLimit={exceededLimitOf(panelData.judgment, limits)}
    focusKey={focusKey}
    onChanged={changed}
    onExcluded={excluded}
    className={wide ? PANEL_SCROLL : undefined} /> :

  panelData?.failed ?
  <p role="alert" className="rounded-2xl border border-line p-5 text-body text-deny">
        이 거래의 판정을 불러오지 못했습니다.{' '}
        <button type="button" onClick={panelQ.reload} className="py-1 font-bold underline">
          다시 시도
        </button>
      </p> :

  panelData ?
  <p className="rounded-2xl border border-line p-5 text-body text-ink2">
        이 거래는 판정 대상에서 빠졌거나 아직 판정하지 않았습니다.
      </p> :

  <span className="block h-96 animate-pulse rounded-2xl bg-line2" />;


  return (
    <AppShell>
      {header}

      {summary && !firstLoad ?
      <AmountHero
        className="mt-6"
        label={`${year}년 경비 가능 금액`}
        amount={summary.byVerdict.AVAILABLE.finalAmount}
        spend={spendOf(summary)}
        shares={sharesOf(summary)}
        counts={false}>

          {/* 한 해 집계는 접대비 한도를 넘은 금액을 위 금액에서 이미 뺐다(api.md 3.7 summary) */}
          {yearLimits.length > 0 &&
        <p>
              {yearLimits.map(limitLine).join(', ')}({PROVISIONAL_NOTE}).
              {yearLimits.some((item) => item.excessAmount > 0) && ' 넘은 금액은 위 금액에서 뺐습니다.'}
            </p>
        }
        </AmountHero> :

      <span className="mt-6 block h-64 animate-pulse rounded-2xl bg-surface" />
      }

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* 좁은 화면에서는 계정과목이 표 위에 온다. 넓은 화면에서는 오른쪽 칸 맨 위다 */}
        <aside className="min-w-0 space-y-6 lg:order-2">
          <AccountBreakdown summary={summary} loading={firstLoad} />
          {wide && selectedId && !firstLoad && <div className="sticky top-24">{panel}</div>}
        </aside>

        <section className="min-w-0 lg:order-1">
          <FilterBar
            name="판정 결과"
            value={filter}
            onChange={(next) => {
              setFilter(next);
              setPage(0);
              setSelectedId(null);
            }}
            options={filters} />

          <Table
            className="mt-3"
            caption={`${year}년 거래별 판정 결과`}
            columns={columns}
            rows={firstLoad ? [] : judgments}
            rowKey={(row) => row.id}
            loading={firstLoad || listQ.loading}
            selectedKey={judgments.find((row) => row.transactionId === selectedId)?.id}
            onRowClick={(row) => select(row.transactionId)}
            empty={empty} />

          {!firstLoad && listPage && judgments.length > 0 && <Pagination page={listPage} onChange={setPage} />}
        </section>
      </div>

      <BottomSheet open={!wide && selectedId !== null} onClose={() => setSelectedId(null)} label="거래 판정 상세">
        {panel}
      </BottomSheet>
    </AppShell>);

}
