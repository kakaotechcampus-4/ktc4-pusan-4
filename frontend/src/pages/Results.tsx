import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CircleHelpIcon, SearchXIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { JudgmentDetailPanel } from '../components/results/JudgmentDetailPanel';
import { VerdictBadge } from '../components/VerdictBadge';
import {
  Button,
  Empty,
  FilterBar,
  Pagination,
  Table,
  type Column } from
'../components/ui';
import { useSession } from '../contexts/SessionContext';
import { api, useApi } from '../api';
import type { Judgment, Transaction, Verdict } from '../types/domain';
import { formatFullDate, formatNumber, formatPeriod, formatWon } from '../utils/format';

type Filter = 'ALL' | Verdict;

/**
 * 3.7 판정 결과.
 * batchId 로 거래별 「현재」 판정을 읽는다. runId 로 읽으면 그 Run 이 만든 판정만 와서
 * 답변·사용자 수정이 화면에 반영되지 않는다.
 */
export function Results() {
  const { batchId } = useSession();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(0);
  /** 고른 거래. 거래 정보를 아직 못 받은 행도 고를 수 있게 id 만 든다 */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 사용자가 고를 때마다 늘린다. 패널은 이 값이 바뀌면 제목으로 초점을 옮긴다. 처음 자동 선택은 0 이라 초점을 뺏지 않는다 */
  const [focusKey, setFocusKey] = useState(0);

  const batchQ = useApi(
    () => batchId ? api.uploads.get(batchId) : Promise.resolve(null),
    [batchId]
  );
  const summaryQ = useApi(
    () => batchId ? api.judgments.summary({ batchId }) : Promise.resolve(null),
    [batchId]
  );
  const judgmentsQ = useApi(
    () =>
    batchId ?
    api.judgments.list({
      batchId,
      verdict: filter === 'ALL' ? undefined : filter,
      page,
      size: 20
    }) :
    Promise.resolve(null),
    [batchId, filter, page]
  );
  const questionsQ = useApi(
    () =>
    batchId ?
    api.questions.grouped({ batchId, status: 'PENDING', size: 1 }) :
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

  const judgments: Judgment[] = judgmentsQ.data?.items ?? [];

  // 판정 응답에는 거래 정보가 없어 지금 페이지의 거래만 따로 받는다 (최대 20건).
  // [id, 거래 | null] 로 받아, 아직 안 온 것(대기)과 못 받은 것(null)을 구분한다
  const transactionsQ = useApi(
    () =>
    Promise.all(
      judgments.map((judgment) =>
      api.transactions.
      get(judgment.transactionId).
      catch(() => null).
      then((transaction) => [judgment.transactionId, transaction] as const)
      )
    ),
    [judgments.map((judgment) => judgment.transactionId).join()]
  );
  const fetched = new Map<string, Transaction | null>(transactionsQ.data ?? []);
  const transactions = new Map(
    [...fetched].filter((entry): entry is [string, Transaction] => entry[1] !== null)
  );

  // 패널은 고른 거래의 현재 판정과 거래를 따로 읽는다. 수정하면 그 행이 목록 맨 위로
  // 올라가도(computedAt DESC) 패널은 그 거래에 머문다
  // 응답과 실패 모두에 어느 거래의 것인지 붙인다. 다른 행을 고른 직후 이전 행의 응답·실패가
  // 남아 있어도, 고른 거래의 것일 때만 그린다
  const panelQ = useApi(
    () => {
      if (!selectedId) return Promise.resolve(null);
      const id = selectedId;
      return Promise.all([api.judgments.list({ transactionId: id }), api.transactions.get(id)]).
      then(([page, transaction]) => ({ id, failed: false as const, judgment: page.items[0] ?? null, transaction })).
      catch(() => ({ id, failed: true as const }));
    },
    [selectedId]
  );
  const panelData = panelQ.data?.id === selectedId ? panelQ.data : null;

  // 처음에는 첫 행을 보여준다
  const firstId = judgments[0]?.transactionId;
  useEffect(() => {
    if (!selectedId && firstId) setSelectedId(firstId);
  }, [selectedId, firstId]);

  // 마지막 행이 다른 분류로 빠지면 그 페이지가 빈다. Pagination 이 사라지므로 첫 페이지로
  useEffect(() => {
    if (page > 0 && judgmentsQ.data && judgmentsQ.data.items.length === 0) setPage(0);
  }, [page, judgmentsQ.data]);

  // 패널은 열릴 때 제목으로 초점을 옮긴다. 좁은 화면에서는 표 아래에 있으므로 그때 함께 스크롤된다
  const select = (transactionId: string) => {
    setSelectedId(transactionId);
    setFocusKey((key) => key + 1);
  };

  const changed = () => {
    judgmentsQ.reload();
    summaryQ.reload();
    panelQ.reload();
  };

  const summary = summaryQ.data;
  const filters = [
  { value: 'ALL' as const, label: '전체', count: summary?.totalCount },
  { value: 'AVAILABLE' as const, label: '가능', count: summary?.byVerdict.AVAILABLE.count },
  { value: 'NEEDS_REVIEW' as const, label: '확인 필요', count: summary?.byVerdict.NEEDS_REVIEW.count },
  { value: 'UNAVAILABLE' as const, label: '불가', count: summary?.byVerdict.UNAVAILABLE.count }];

  const unresolved = questionsQ.data?.unresolved;
  const questionGroups = questionsQ.data?.page.totalElements ?? 0;
  const answeredGroups = answeredQ.data?.page.totalElements ?? 0;

  const pending = (width: string) =>
  <span className={`block h-4 ${width} animate-pulse rounded bg-line2`} />;

  const missing = (judgment: Judgment) =>
  fetched.has(judgment.transactionId) && fetched.get(judgment.transactionId) === null;

  const columns: Column<Judgment>[] = [
  {
    header: '승인일',
    width: 'w-[7.5rem]',
    hideBelow: 'sm',
    cell: (row) => {
      const transaction = transactions.get(row.transactionId);
      if (!transaction) return missing(row) ? '—' : pending('w-20');
      return (
        <span className="whitespace-nowrap tabular-nums text-ink2">
            {formatFullDate(transaction.approvedAt)}
          </span>);

    }
  },
  {
    header: '가맹점',
    // 남는 폭을 가맹점이 갖고 넘치면 말줄임한다. 금액·판정은 좁은 화면에서도 보여야 한다
    width: 'w-full max-w-0',
    cell: (row) => {
      const transaction = transactions.get(row.transactionId);
      if (!transaction)
      return missing(row) ?
      <span className="text-small text-muted">거래 정보를 불러오지 못했습니다</span> :
      pending('w-32');
      return (
        <span className="block min-w-0">
            <span className="flex items-center gap-1.5 truncate font-medium text-ink">
              {/* 고른 행은 옅은 바탕만으로는 잘 안 보여 점을 붙인다 */}
              {row.transactionId === selectedId &&
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-accent" />
          }
              <span className="truncate">{transaction.merchantNorm}</span>
            </span>
            <span className="block truncate text-small text-muted">
              {/* 승인일 열은 좁은 화면에서 숨기므로, 그 정보를 여기로 옮긴다 */}
              <span className="sm:hidden">{formatFullDate(transaction.approvedAt)} · </span>
              {transaction.merchantRaw} · {transaction.merchantCategory}
              {transaction.installmentMonths > 0 &&
            ` · ${transaction.installmentMonths}개월 할부`}
            </span>
          </span>);

    }
  },
  {
    header: '금액',
    align: 'right',
    cell: (row) => {
      const transaction = transactions.get(row.transactionId);
      if (!transaction) return missing(row) ? '—' : pending('ml-auto w-20');
      // 「일부 인정」은 AVAILABLE + finalAmount < amount 다 (2.1).
      // 자산은 그해 넣을 수 있는 한도라 「최대」로 쓴다 (CONTEXT.md G4 화면 문구)
      const asset = row.attributes['자산'] === true;
      const partial =
      row.verdict.code === 'AVAILABLE' &&
      row.finalAmount !== null &&
      (asset || row.finalAmount !== transaction.amount);
      return (
        <span className="block">
            <span className="whitespace-nowrap font-semibold text-ink">{formatWon(transaction.amount)}</span>
            {partial && row.finalAmount !== null &&
          <span className="block whitespace-nowrap text-caption text-ok">
                {asset ? '최대' : '산입'} {formatWon(row.finalAmount)}
              </span>
          }
          </span>);

    }
  },
  {
    header: '판정',
    align: 'right',
    cell: (row) =>
    <span className="inline-flex flex-col items-end gap-1">
          <VerdictBadge verdict={row.verdict} />
          {row.origin.type === 'OVERRIDE' &&
      <span className="text-caption text-muted">직접 수정</span>
      }
          {/* ②(넘김)는 목록에서도 ①·③과 다르게 보여야 한다 (rule-card-fields.md) */}
          {row.outOfScope && row.origin.type !== 'OVERRIDE' &&
      <span className="text-caption text-muted">세무사에게 넘김</span>
      }
        </span>

  }];


  const header =
  <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-small font-semibold text-accent">4단계 · 반영</p>
        <h1 className="mt-1.5 text-h2 font-bold tracking-tight text-ink">판정 결과</h1>
        {summary &&
      <p className="mt-2 text-body tabular-nums text-muted">
            {batchQ.data &&
        `${formatPeriod(batchQ.data.periodStart, batchQ.data.periodEnd)} · `}
            {formatNumber(summary.totalCount)}건 · 인정 경비{' '}
            <strong className="font-semibold text-ink">
              {formatWon(summary.byVerdict.AVAILABLE.finalAmount)}
            </strong>
          </p>
      }
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* 확인할 질문이 없을 때는 아래 안내가 사라지므로, 답을 바꾸러 가는 길을 여기 남긴다 */}
        {!(unresolved && unresolved.count > 0) && answeredGroups > 0 &&
      <Button to="/questions" variant="ghost" size="sm">
            답한 질문 보기
          </Button>
      }
        <Button to="/summary" variant="secondary" size="sm">
          요약 보기
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </header>;


  if (!batchId) {
    return (
      <AppShell>
        {header}
        <Empty
          className="mt-6"
          icon={<SearchXIcon className="h-5 w-5" />}
          title="올린 카드내역이 없습니다"
          description="카드내역을 올리고 판정을 마치면 결과가 여기에 쌓입니다."
          action={
          <Button to="/upload" size="sm" variant="secondary">
              카드내역 올리기
            </Button>
          } />

      </AppShell>);

  }

  const failed = Boolean(judgmentsQ.error || summaryQ.error);
  const nothingJudged = summary?.totalCount === 0;

  const empty = failed ?
  <Empty
    icon={<SearchXIcon className="h-5 w-5" />}
    title="판정 결과를 불러오지 못했습니다"
    description="잠시 후 다시 시도해 주세요. 계속 안 되면 새로고침해 주세요."
    action={
    <Button
      size="sm"
      variant="secondary"
      onClick={() => {
        judgmentsQ.reload();
        summaryQ.reload();
      }}>

          다시 시도
        </Button>
    } /> :

  nothingJudged ?
  <Empty
    icon={<SearchXIcon className="h-5 w-5" />}
    title="아직 판정한 거래가 없습니다"
    description="분류 확인과 사업자 문진을 마친 뒤 판정을 실행하면 결과가 나옵니다."
    action={
    <Button to="/confirm" size="sm" variant="secondary">
            판정하러 가기
          </Button>
    } /> :

  filter === 'NEEDS_REVIEW' ?
  <Empty
    tone="ok"
    icon={<SearchXIcon className="h-5 w-5" />}
    title="확인이 필요한 거래가 없습니다"
    description="남은 판정은 모두 가능 또는 불가로 정리됐습니다." /> :

  <Empty
    icon={<SearchXIcon className="h-5 w-5" />}
    title="이 판정에 해당하는 거래가 없습니다"
    description="다른 판정을 골라 보세요." />;


  return (
    <AppShell>
      {header}

      {unresolved && unresolved.count > 0 &&
      <Link
        to="/questions"
        className="mt-6 flex items-center gap-3 rounded-2xl border border-warn-line bg-warn-bg px-5 py-4 transition-colors duration-150 ease-snap hover:bg-warn-bg/70">

          <CircleHelpIcon className="h-5 w-5 shrink-0 text-warn" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold tabular-nums text-ink">
              확인 필요 {formatNumber(unresolved.count)}건 · {formatWon(unresolved.amount)}
            </span>
            <span className="mt-0.5 block text-small text-ink2">
              같은 사유끼리 묶은 질문 {formatNumber(questionGroups)}개가 남았습니다. 답하면 묶인
              거래를 바로 다시 판정합니다.
            </span>
          </span>
          <ArrowRightIcon className="h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
        </Link>
      }

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <FilterBar
            name="판정 결과"
            value={filter}
            onChange={(next) => {
              setFilter(next);
              setPage(0);
            }}
            options={filters} />

          <Table
            className="mt-3"
            caption="거래별 판정 결과"
            columns={columns}
            rows={failed ? [] : judgments}
            rowKey={(row) => row.id}
            loading={judgmentsQ.loading}
            selectedKey={judgments.find((row) => row.transactionId === selectedId)?.id}
            onRowClick={(row) => select(row.transactionId)}
            empty={empty} />

          {!failed && judgmentsQ.data && judgments.length > 0 &&
          <Pagination page={judgmentsQ.data.page} onChange={setPage} />
          }
        </section>

        {selectedId && !failed && !nothingJudged &&
        // 패널이 화면보다 길면 수정 버튼·이력이 접힌 아래로 밀린다. 화면 높이 안에서 따로 스크롤한다
        <aside className="lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:self-start lg:overflow-y-auto">
            {panelData && !panelData.failed && panelData.judgment ?
          <JudgmentDetailPanel
            key={selectedId}
            judgment={panelData.judgment}
            transaction={panelData.transaction}
            focusKey={focusKey}
            onChanged={changed} /> :

          // 수정 뒤 다시 읽기가 실패해도 이전 판정을 그리지 않고 실패를 알린다
          panelData?.failed ?
          <div role="alert" className="rounded-2xl border border-deny-line bg-deny-bg p-5 text-body text-deny">
                이 거래의 판정을 불러오지 못했습니다.{' '}
                <button type="button" onClick={panelQ.reload} className="font-semibold underline">
                  다시 시도
                </button>
              </div> :

          panelData ?
          <p className="rounded-2xl border border-line bg-surface p-5 text-body text-muted">
                이 거래에는 현재 판정이 없습니다. 판정 대상에서 빠졌거나 아직 판정하지 않은 거래입니다.
              </p> :

          <span className="block h-96 animate-pulse rounded-2xl bg-line2" />
          }
          </aside>
        }
      </div>
    </AppShell>);

}
