import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CircleHelpIcon, DownloadIcon, SearchXIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { StepEyebrow } from '../components/StepEyebrow';
import { JudgmentDetailPanel } from '../components/results/JudgmentDetailPanel';
import { AmountHero } from '../components/results/AmountHero';
import { sharesOf } from '../utils/shares';
import { categoryLabel, merchantTitle, verdictNote } from '../components/results/display';
import { VerdictBadge } from '../components/VerdictBadge';
import {
  BottomSheet,
  Button,
  Empty,
  FilterBar,
  Pagination,
  Table,
  type Column } from
'../components/ui';
import { useSession } from '../contexts/SessionContext';
import { useAssistantSubject } from '../components/assistant/context';
import { api, ApiRequestError, useApi } from '../api';
import type { Judgment, Verdict } from '../types/domain';
import { formatFullDate, formatNumber, formatPeriod, formatWon } from '../utils/format';
import { AWAITING_ANSWER, awaitingOf } from '../utils/verdict';
import { readAll } from '../api/readAll';
import { download, exportRowOf, judgmentsCsv } from '../utils/csv';
import { exceededLimitOf, excessNote } from '../utils/limit';
import { useMediaQuery } from '../hooks/useMediaQuery';

/** 답변 대기는 판정이 아니라 불가에 붙는 표지라 서버 필터가 없다. 불가를 읽어 화면에서 가른다 (C12) */
type Filter = 'ALL' | Verdict | 'AWAITING';

/** 내보내기 API(#214)가 아직 없는 서버는 판정 목록을 끝까지 읽어 같은 모양을 만든다 */
const readAllJudgments = (batchId: string) => readAll((page, size) => api.judgments.list({ batchId, page, size }));

/** 표 한 쪽의 행 수. 서버 목록의 기본 크기와 같다 */
const PAGE_SIZE = 20;

/**
 * 세무사에게 넘길 내보내기. 인정 금액, 답한 내용, 연도별 접대비 한도(#226)가 함께 온다.
 * 내보내기가 없는 서버는 `/judgments/export` 를 `/judgments/{judgmentId}` 로 읽어 400 VALIDATION_ERROR(id 가 UUID 가 아님)를,
 * 그 경로도 없으면 404 를 준다. 이때만 판정 목록으로 만든다. 내보내기의 400 INVALID_EXPORT_SCOPE 는 그대로 실패다
 */
const noExportApi = (caught: unknown) =>
caught instanceof ApiRequestError && (
caught.status === 404 || caught.status === 400 && caught.code === 'VALIDATION_ERROR');

const readExport = (batchId: string) =>
api.judgments.
export({ batchId }).
catch(async (caught: unknown) => {
  if (!noExportApi(caught)) throw caught;
  return { items: (await readAllJudgments(batchId)).map(exportRowOf), limits: [] };
});

/** 표 머리 글자. 골격 줄 옆에서 열이 좁아져도 한 글자씩 꺾이지 않게 한다 (C66) */
const head = (text: string) => <span className="whitespace-nowrap">{text}</span>;

/**
 * 넓은 화면의 상세 상자. 화면보다 길면 테두리 상자째 안에서 스크롤해, 스크롤해도 테두리가 끊기지 않는다 (C72).
 * macOS 는 스크롤 막대를 숨겨 아래가 더 있는지 모르므로 막대를 늘 그린다.
 * 높이는 끝까지 내렸을 때를 기준으로 잡는다. 그때 sticky 상자는 표 영역 바닥(꼬리말 위, 화면 아래에서 약 11rem)에
 * 밀려 올라가므로, 상자가 그보다 길면 위쪽이 머리말(72px) 밑으로 들어간다. 표가 짧아도 같다
 */
const PANEL_SCROLL =
'max-h-[calc(100vh-16.5rem)] overflow-y-auto [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted/40 [&::-webkit-scrollbar]:w-2';

/**
 * 3.7 판정 결과.
 * batchId 로 거래별 「현재」 판정을 읽는다. runId 로 읽으면 그 Run 이 만든 판정만 와서
 * 답변·사용자 수정이 화면에 반영되지 않는다.
 */
export function Results() {
  const { batchId, batchStatus, reloadBatch } = useSession();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(0);
  /** 고른 거래. 거래 정보를 아직 못 받은 행도 고를 수 있게 id 만 든다 */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 사용자가 고를 때마다 늘린다. 패널은 이 값이 바뀌면 제목으로 초점을 옮긴다. 처음 자동 선택은 0 이라 초점을 뺏지 않는다 */
  const [focusKey, setFocusKey] = useState(0);
  // 「이거 왜 불가야?」의 「이거」 (FR-2)
  useAssistantSubject(selectedId);
  /** 넓은 화면은 표 옆에 상세를 늘 띄우고, 좁은 화면은 행을 누를 때만 아래에서 올린다 */
  const wide = useMediaQuery('(min-width: 1024px)');
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  /** 방금 판정 대상에서 뺀 거래의 이름. 다시 넣는 곳을 알려 준다 */
  const [excludedName, setExcludedName] = useState<string | null>(null);

  const batchQ = useApi(
    () => batchId ? api.uploads.get(batchId) : Promise.resolve(null),
    [batchId]
  );
  const summaryQ = useApi(
    () => batchId ? api.judgments.summary({ batchId }) : Promise.resolve(null),
    [batchId]
  );
  // 답할 질문 안내의 집계(unresolved). 집계는 쪽과 상관없이 오므로 한 개만 읽는다
  const questionsQ = useApi(
    () =>
    batchId ?
    api.questions.list({ batchId, status: 'PENDING', size: 1 }) :
    Promise.resolve(null),
    [batchId]
  );
  /**
   * 현재 판정을 끝까지 읽어 화면에서 거르고 쪽을 나눈다. 서버는 판정한 시각 순으로 주므로 답하거나 고친 행이
   * 맨 위로 올라온다. 여기서 승인일 순으로 다시 세운다. 경비 가능 금액의 바탕인 결제 합계도 여기서 더한다
   */
  const allQ = useApi(
    () =>
    batchId ?
    readAllJudgments(batchId).then((items) =>
    [...items].sort((a, b) =>
    b.transaction.approvedAt.localeCompare(a.transaction.approvedAt) || b.id.localeCompare(a.id)
    )
    ) :
    Promise.resolve(null),
    [batchId]
  );
  // 불가와 답변 대기를 가른다 (C12). 답을 기다리는 질문을 끝까지 읽는다. 못 읽으면 답변 대기 표지만 빠진다
  const pendingQ = useApi(
    () =>
    batchId ?
    readAll((page, size) => api.questions.list({ batchId, status: 'PENDING', page, size })).then(
      (pending) => new Set(pending.map((question) => question.transactionId))
    ) :
    Promise.resolve(null),
    [batchId]
  );
  // 다 답한 뒤에도 답을 바꾸러 갈 수 있어야 한다 (3.10 정정, F1-c)
  const answeredQ = useApi(
    () =>
    batchId ?
    api.questions.grouped({ batchId, status: 'ANSWERED', size: 1 }) :
    Promise.resolve(null),
    [batchId]
  );
  // 분류하지 않고 넘긴 거래는 판정에 없다. 결과에서도 알린다 (C36). 요약과 같은 조건으로 센다
  const unclassifiedQ = useApi(
    () =>
    batchId ?
    api.transactions.list({ batchId, status: 'JUDGEABLE', classificationStatus: 'NEEDS_REVIEW', size: 1 }) :
    Promise.resolve(null),
    [batchId]
  );

  const all = allQ.data;
  const awaiting = pendingQ.data ?? new Set<string>();
  const unavailable = all?.filter((judgment) => judgment.verdict.code === 'UNAVAILABLE') ?? [];
  const awaitingRows = awaitingOf(unavailable, awaiting);
  const awaitingCount = awaitingRows.length;
  const spend = all ? all.reduce((sum, judgment) => sum + judgment.transaction.amount, 0) : null;
  const filtered =
  filter === 'ALL' ?
  all ?? [] :
  filter === 'AWAITING' ?
  awaitingRows :
  filter === 'UNAVAILABLE' ?
  unavailable.filter((judgment) => !awaiting.has(judgment.transactionId)) :
  all?.filter((judgment) => judgment.verdict.code === filter) ?? [];
  const listPage = {
    number: page,
    size: PAGE_SIZE,
    totalElements: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
    hasNext: (page + 1) * PAGE_SIZE < filtered.length
  };
  const judgments: Judgment[] = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // 패널은 고른 거래의 현재 판정을 따로 읽는다(거래 요약이 함께 온다). 수정하면 그 행이 다른 판정으로
  // 옮겨 가도 패널은 그 거래에 머문다
  // 응답과 실패 모두에 어느 거래의 것인지 붙인다. 다른 행을 고른 직후 이전 행의 응답·실패가
  // 남아 있어도, 고른 거래의 것일 때만 그린다
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

  /**
   * 방금 판정 대상에서 뺀 거래. 목록을 다시 읽는 동안에는 옛 목록이 남아 있어서,
   * 첫 행 자동 선택이 뺀 거래를 다시 고르지 않게 건너뛴다
   */
  const excludedId = useRef<string | null>(null);

  // 넓은 화면은 처음에 첫 행을 보여 준다. 좁은 화면에서 그러면 들어오자마자 창이 덮는다
  const firstId = judgments.find((judgment) => judgment.transactionId !== excludedId.current)?.transactionId;
  useEffect(() => {
    if (wide && !selectedId && firstId) setSelectedId(firstId);
  }, [wide, selectedId, firstId]);

  // 넓은 화면에서 고른 채로 창을 줄이면 아래 창이 저절로 뜬다. 줄일 때 고른 것을 푼다
  useEffect(() => {
    if (!wide) setSelectedId(null);
  }, [wide]);

  // 마지막 행이 다른 분류로 빠지면 그 페이지가 빈다. Pagination 이 사라지므로 첫 페이지로
  const pageEmpty = Boolean(all) && judgments.length === 0;
  useEffect(() => {
    if (page > 0 && pageEmpty) setPage(0);
  }, [page, pageEmpty]);

  // 패널은 열릴 때 제목으로 초점을 옮긴다. 좁은 화면에서는 아래에서 올라오는 창으로 연다
  const select = (transactionId: string) => {
    setSelectedId(transactionId);
    setFocusKey((key) => key + 1);
  };

  // 판정 대상에서 빼면 그 거래의 질문도 집계에서 빠진다(3.9). 질문 안내도 다시 읽는다
  const changed = () => {
    allQ.reload();
    pendingQ.reload();
    summaryQ.reload();
    panelQ.reload();
    questionsQ.reload();
  };

  /** 처음 불러오기가 실패했을 때. 표만이 아니라 기간, 질문 안내, 분류 안내도 다시 읽는다 (C64) */
  const reloadAll = () => {
    batchQ.reload();
    summaryQ.reload();
    allQ.reload();
    pendingQ.reload();
    questionsQ.reload();
    answeredQ.reload();
    unclassifiedQ.reload();
  };

  /** 판정 대상에서 뺀 거래는 목록에서 사라진다. 다시 넣는 곳을 알려 준다 */
  const excluded = (merchant: string) => {
    excludedId.current = selectedId;
    setSelectedId(null);
    setExcludedName(merchant);
    changed();
  };

  const exportCsv = async () => {
    if (!batchId || exporting) return;
    setExporting(true);
    setExportFailed(false);
    try {
      const { items, limits } = await readExport(batchId);
      const batch = batchQ.data;
      const period = batch ? `${batch.periodStart}_${batch.periodEnd}` : batchId.slice(0, 8);
      download(`PreeT-판정결과-${period}.csv`, judgmentsCsv(items, limits));
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };

  const summary = summaryQ.data;
  const limits = summary?.limits ?? [];
  // batch 합계는 접대비 한도 전 금액이다(#226). 넘은 해가 있으면 헤더 합계 아래에 알린다
  const excess = excessNote(limits);
  const filters = [
  { value: 'ALL' as const, label: '전체', count: summary?.totalCount },
  { value: 'AVAILABLE' as const, label: '가능', count: summary?.byVerdict.AVAILABLE.count },
  { value: 'NEEDS_REVIEW' as const, label: '확인 필요', count: summary?.byVerdict.NEEDS_REVIEW.count },
  {
    value: 'UNAVAILABLE' as const,
    label: '불가',
    count: summary && all && (pendingQ.data || pendingQ.error) ? summary.byVerdict.UNAVAILABLE.count - awaitingCount : undefined
  },
  // 답을 기다리는 거래가 있을 때만 둔다. 고른 채로 다 답했으면 빈 목록이 보이도록 남긴다
  ...(awaitingCount > 0 || filter === 'AWAITING' ?
  [{ value: 'AWAITING' as const, label: AWAITING_ANSWER, count: awaitingCount }] :
  [])];

  const unresolved = questionsQ.data?.unresolved;
  // 다시 읽다가 실패하면 예전 질문 수를 띄우지 않고 실패를 알린다
  const questionsFailed = Boolean(questionsQ.error) && !questionsQ.loading;
  const answeredGroups = answeredQ.data?.page.totalElements ?? 0;
  const unclassified = unclassifiedQ.data?.page.totalElements ?? 0;
  /**
   * 처음 읽는 동안. 머리글 줄, 질문 안내, 분류 안내, 표를 다 받은 뒤 한 번에 그린다.
   * 따로 그리면 늦게 온 줄이 이미 그린 표를 밀어 내린다 (C66). 실패한 것은 기다리지 않는다
   */
  const firstLoad = [batchQ, summaryQ, allQ, questionsQ, pendingQ, unclassifiedQ].some(
    (query) => query.loading && !query.data && !query.error
  );

  const columns: Column<Judgment>[] = [
  {
    header: head('승인일'),
    width: 'w-[7.5rem]',
    hideBelow: 'sm',
    cell: (row) =>
    <span className="whitespace-nowrap tabular-nums text-ink2">
        {formatFullDate(row.transaction.approvedAt)}
      </span>

  },
  {
    header: head('가맹점'),
    // 남는 폭을 가맹점이 갖고 넘치면 말줄임한다. 금액·판정은 좁은 화면에서도 보여야 한다
    width: 'w-full max-w-0',
    cell: (row) => {
      const { transaction } = row;
      return (
        <span className="block min-w-0">
            <span className="block truncate font-normal text-ink">{merchantTitle(transaction)}</span>
            {/* 승인일 열은 좁은 화면에서 숨기므로 여기로 옮긴다. 가맹점명 줄에 붙이면 말줄임에 같이 잘린다 */}
            <span className="block whitespace-nowrap text-small tabular-nums text-muted sm:hidden">
              {formatFullDate(transaction.approvedAt)}
            </span>
            <span className="block truncate text-small text-ink2">
              {categoryLabel(transaction.merchantCategory)}
              {transaction.installmentMonths > 0 && `, ${transaction.installmentMonths}개월 할부`}
            </span>
          </span>);

    }
  },
  {
    header: head('금액'),
    align: 'right',
    cell: (row) => {
      const { transaction } = row;
      // 「일부 인정」은 AVAILABLE + finalAmount < amount 다 (2.1).
      // 자산은 그해 넣을 수 있는 한도라 「최대」로 쓴다 (CONTEXT.md G4 화면 문구)
      const asset = row.attributes['자산'] === true;
      const partial =
      row.verdict.code === 'AVAILABLE' &&
      row.finalAmount !== null && (
      asset || row.finalAmount !== transaction.amount);
      // 한도를 넘은 해의 접대비는 거래별 금액이 없다(#226). 금액 대신 한도 대상임을 적는다
      const overLimit = exceededLimitOf(row, limits);
      return (
        <span className="block">
            <span className="whitespace-nowrap font-bold text-ink">{formatWon(transaction.amount)}</span>
            {overLimit ?
          <span className="block whitespace-nowrap text-caption text-ink2">연간 한도 대상</span> :
          partial && row.finalAmount !== null &&
          <span className="block whitespace-nowrap text-caption text-ink2">
                  {asset ? '최대' : '경비 가능'} {formatWon(row.finalAmount)}
                </span>
          }
          </span>);

    }
  },
  {
    header: head('판정'),
    align: 'right',
    cell: (row) => {
      // 직접 수정, 세무사에게 넘김(rule-card-fields.md ②), 답변 대기는 같은 배지라도 할 일이 달라 배지 아래에 적는다
      const note = verdictNote(row, awaiting.has(row.transactionId));
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
        <StepEyebrow />
        <h1 className="mt-1.5 text-h2 font-bold tracking-tight text-ink">결과</h1>
        {batchQ.data &&
      <p className="mt-1 text-small tabular-nums text-ink2">
            {formatPeriod(batchQ.data.periodStart, batchQ.data.periodEnd)}
          </p>
      }
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* 판정이 끝난 뒤 나가는 길. 빵부스러기의 「홈」만으로는 눈에 띄지 않는다 (#242 리뷰) */}
          <Button to="/" variant="ghost" size="sm" className="whitespace-nowrap">
            홈으로
          </Button>
          {/* 확인할 질문이 없을 때는 아래 안내가 사라지므로, 답을 바꾸러 가는 길을 여기 남긴다 */}
          {!(unresolved && unresolved.count > 0) && answeredGroups > 0 &&
        <Button to="/questions" variant="ghost" size="sm" className="whitespace-nowrap">
              답한 질문 보기
            </Button>
        }
          {batchId && summary && summary.totalCount > 0 &&
        <Button
          variant="ghost"
          size="sm"
          className="whitespace-nowrap"
          disabled={exporting}
          onClick={() => void exportCsv()}>

              <DownloadIcon className="h-4 w-4" aria-hidden="true" />
              {exporting ? 'CSV 만드는 중…' : 'CSV 내려받기'}
            </Button>
        }
          <Button to="/summary" variant="secondary" size="sm" className="whitespace-nowrap">
            요약 보기
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        {/* 실패는 누른 버튼 옆에 오류로 알린다. 안내 상자와 같은 모양이면 실패로 읽히지 않는다 (C67) */}
        {exportFailed &&
      <p role="alert" className="text-small text-deny">
            CSV를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.
          </p>
      }
      </div>
    </header>;


  if (!batchId) {
    // 로그인 직후 업로드 목록을 고르는 동안에는 「없다」고 하지 않는다. 못 읽었으면 다시 시도를 준다 (C56)
    return (
      <AppShell>
        {header}
        {batchStatus === 'loading' ?
        <Table className="mt-6" caption="거래별 판정 결과" columns={columns} rows={[]} rowKey={() => ''} loading /> :
        batchStatus === 'error' ?
        <Empty
          className="mt-6"
          tone="error"
          icon={<SearchXIcon className="h-5 w-5" />}
          title="올린 카드내역을 불러오지 못했습니다"
          action={
          <Button size="sm" variant="secondary" onClick={reloadBatch}>
                다시 시도
              </Button>
          } /> :


        <Empty
          className="mt-6"
          icon={<SearchXIcon className="h-5 w-5" />}
          title="올린 카드내역이 없습니다"
          action={
          <Button to="/upload" size="sm" variant="secondary">
                카드내역 올리기
              </Button>
          } />

        }
      </AppShell>);

  }

  // 답을 기다리는 질문을 못 읽으면 답변 대기 목록만 실패로 보인다. 다른 목록은 표지만 빠진 채 그린다
  const failed = Boolean(allQ.error || summaryQ.error || filter === 'AWAITING' && pendingQ.error);
  const nothingJudged = summary?.totalCount === 0;

  const empty = failed ?
  <Empty
    tone="error"
    icon={<SearchXIcon className="h-5 w-5" />}
    title="판정 결과를 불러오지 못했습니다"
    action={
    <Button size="sm" variant="secondary" onClick={reloadAll}>
          다시 시도
        </Button>
    } /> :

  nothingJudged ?
  <Empty
    icon={<SearchXIcon className="h-5 w-5" />}
    title="아직 판정한 거래가 없습니다"
    action={
    <Button to="/confirm" size="sm" variant="secondary">
            판정하러 가기
          </Button>
    } /> :

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

  // 수정 뒤 다시 읽기가 실패해도 이전 판정을 그리지 않고 실패를 알린다
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

      {/* 건수는 아래 필터마다 있다. 판에는 경비 가능 금액과 판정별 결제 금액만 둔다 */}
      {summary && !firstLoad && summary.totalCount > 0 ?
      <AmountHero
        className="mt-6"
        amount={summary.byVerdict.AVAILABLE.finalAmount}
        spend={allQ.error ? null : spend}
        shares={all && !allQ.error ? sharesOf(all, pendingQ.error ? null : awaitingRows) : null}
        counts={false}>

          {excess && <p>{excess}</p>}
          {unclassified > 0 &&
        <p className="flex flex-wrap items-center gap-x-2">
              분류가 필요한 거래 {formatNumber(unclassified)}건은 판정하지 않았습니다.
              <Link
            to="/preview"
            className="inline-flex items-center gap-1 py-1 font-bold text-accent hover:underline">

                분류 확인하기
                <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </p>
        }
        </AmountHero> :

      // 높이를 미리 잡아 둔다. 늦게 들어와도 아래를 밀지 않는다 (C66)
      batchId && firstLoad && <span className="mt-6 block h-64 animate-pulse rounded-2xl bg-surface" />
      }

      {excludedName &&
      <p
        role="status"
        className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-line px-4 py-3 text-small text-ink2">

          <span>
            {excludedName} 거래를 판정 대상에서 뺐습니다.{' '}
            <Link to="/transactions" className="font-bold text-accent hover:underline">
              거래에서 다시 넣기
            </Link>
          </span>
          <button type="button" onClick={() => setExcludedName(null)} className="shrink-0 py-1 text-ink2 hover:text-ink">
            닫기
          </button>
        </p>
      }

      {!firstLoad && !questionsFailed && unresolved && unresolved.count > 0 &&
      <Link
        to="/questions"
        className="mt-6 flex items-center gap-3 rounded-2xl border border-line px-5 py-4 transition-colors duration-150 ease-snap hover:bg-surface">

          <CircleHelpIcon className="h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            {/* count 는 「확인 필요」 판정 수가 아니라 PENDING 질문 수다(3.9). 한 거래에 질문이 여럿이고, 불가에도 소명 질문이 남는다 */}
            <span className="block text-body font-bold tabular-nums text-ink">
              답할 질문 {formatNumber(unresolved.count)}개
            </span>
            <span className="mt-0.5 block text-small tabular-nums text-ink2">
              관련 거래 {formatWon(unresolved.amount)}, 답하면 다시 판정합니다.
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-small font-bold text-accent">
            질문에 답하기
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </span>
        </Link>
      }
      {/* 판정을 마친 결과에는 대개 답할 질문이 있다. 그 자리를 미리 잡아 표가 밀려 내려가지 않게 한다 (C66) */}
      {firstLoad && <span aria-hidden="true" className="mt-6 block h-20 animate-pulse rounded-2xl bg-line2" />}
      {/* 질문을 못 읽으면 안내가 말없이 사라지지 않게 그 자리에 알린다 (C64) */}
      {questionsFailed &&
      <p role="alert" className="mt-6 text-small text-deny">
          답할 질문을 불러오지 못했습니다.{' '}
          <button type="button" onClick={questionsQ.reload} className="py-1 font-bold underline">
            다시 시도
          </button>
        </p>
      }

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <FilterBar
            name="판정 결과"
            value={filter}
            onChange={(next) => {
              setFilter(next);
              setPage(0);
              // 다른 판정을 고르면 보던 거래가 목록에 없을 수 있다. 새 목록의 첫 행으로 다시 고른다
              setSelectedId(null);
            }}
            options={filters} />

          <Table
            className="mt-3"
            caption="거래별 판정 결과"
            columns={columns}
            rows={failed || firstLoad ? [] : judgments}
            rowKey={(row) => row.id}
            loading={allQ.loading || firstLoad}
            selectedKey={judgments.find((row) => row.transactionId === selectedId)?.id}
            onRowClick={(row) => select(row.transactionId)}
            empty={empty} />

          {!failed && !firstLoad && judgments.length > 0 && <Pagination page={listPage} onChange={setPage} />}
        </section>

        {wide && selectedId && !failed && !nothingJudged && !firstLoad &&
        <aside className="sticky top-24 self-start">{panel}</aside>
        }
      </div>

      <BottomSheet
        open={!wide && selectedId !== null && !failed && !nothingJudged}
        onClose={() => setSelectedId(null)}
        label="거래 판정 상세">

        {panel}
      </BottomSheet>
    </AppShell>);

}
