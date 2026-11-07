import { useEffect, useState } from 'react';
import { ChevronDownIcon, SearchXIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { api, ApiRequestError, useApi } from '../api';
import { useSession } from '../contexts/SessionContext';
import { categoryLabel, merchantTitle } from '../components/results/display';
import {
  Badge,
  Button,
  Empty,
  FilterBar,
  Pagination,
  Table,
  type Column } from
'../components/ui';
import type { EffectiveStatus, Transaction, UploadBatch } from '../types/domain';
import { formatFullDate, formatWon } from '../utils/format';

type StatusFilter = 'ALL' | EffectiveStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
{ value: 'ALL', label: '전체' },
{ value: 'JUDGEABLE', label: '판정대상' },
{ value: 'EXCLUDED', label: '대상제외' },
{ value: 'CANCELED_OFFSET', label: '취소상계' }];


/** 고른 달. 빈 문자열은 전체 기간, 아니면 「2026-01」 */
type MonthKey = string;
const ALL_MONTHS: MonthKey = '';

/** 이만큼 이하의 달이면 상태 필터와 같은 버튼 묶음으로, 넘으면 펼침 목록으로 고른다 */
const MONTH_BUTTONS_MAX = 4;

/** 업로드 기간에 든 달. 해를 넘기면 해도 적는다. 기간을 모르면 한 해 열두 달 */
const monthsOf = (batch: UploadBatch | null): { value: MonthKey; label: string }[] => {
  if (!batch)
  return Array.from({ length: 12 }, (_, index) => ({ value: `-${index + 1}`, label: `${index + 1}월` }));
  const [startYear, startMonth] = batch.periodStart.split('-').map(Number);
  const [endYear, endMonth] = batch.periodEnd.split('-').map(Number);
  const months: { value: MonthKey; label: string }[] = [];
  for (let year = startYear, month = startMonth; year < endYear || year === endYear && month <= endMonth;) {
    months.push({
      value: `${year}-${month}`,
      label: startYear === endYear ? `${month}월` : `${year}년 ${month}월`
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
};

/** 「2026-1」은 그해 1월, 「-1」은 해를 모르는 1월 */
const monthQuery = (key: MonthKey) => {
  if (key === ALL_MONTHS) return {};
  const [year, month] = key.split('-');
  return { ...(year ? { year: Number(year) } : {}), month: Number(month) };
};

/** 탭 건수를 서버에 묻는 상태. 전체는 셋을 더한다 — 거래마다 effectiveStatus 는 하나다 */
const COUNTED: EffectiveStatus[] = ['JUDGEABLE', 'EXCLUDED', 'CANCELED_OFFSET'];

/**
 * 분류 확인(/preview)이 기다리는 거래. 서버는 판정 대상인 거래에만 분류 확인을 만들고 그것만 센다.
 * 빠진 정산 행(포인트사용 같은)은 미분류여도 고를 것이 없다 (C108)
 */
const needsCategory = (row: Transaction) =>
row.classificationStatus.code === 'NEEDS_REVIEW' && row.effectiveStatus.code === 'JUDGEABLE';

/**
 * 3.4 거래 목록.
 * 판정 대상에서 빼고 넣는 화면이다. 취소상계는 파서가 정하므로 사용자가 바꿀 수 없다(2.3).
 */
export function Transactions() {
  const { batchId, batchStatus, reloadBatch } = useSession();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [month, setMonth] = useState<MonthKey>(ALL_MONTHS);
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 포함 API 는 다시 판정하지 않는다(#135). 제외는 현재 결과에서 바로 빠지지만, 다시 넣은 거래는
  // 새 판정을 돌리기 전까지 판정이 없거나 옛 답으로 낸 판정이 남는다.
  // 미분류 거래는 판정에 넘기지 않으므로 분류 확인이 먼저다. 다시 넣으면 서버가 분류 확인 항목을 만든다(#148)
  const [rerunNeeded, setRerunNeeded] = useState<'run' | 'classify' | null>(null);

  // 달 고르기는 업로드 기간에 든 달만 보인다. 못 읽으면 열두 달을 다 보인다
  const batchQ = useApi(
    () => batchId ? api.uploads.get(batchId) : Promise.resolve(null),
    [batchId]
  );
  const months = monthsOf(batchQ.error ? null : batchQ.data);

  // 보던 업로드가 없으면 묻지 않는다. batchId 없이 부르면 모든 업로드의 거래가 온다
  const listQ = useApi(
    () =>
    batchId ?
    api.transactions.list({
      batchId,
      status: status === 'ALL' ? undefined : status,
      ...monthQuery(month),
      page,
      size: 20
    }) :
    Promise.resolve(null),
    [batchId, status, month, page]
  );

  // 탭 옆 건수 (C97). 고른 달 안에서 센다 — 누르면 나오는 행 수와 같아야 한다
  const countsQ = useApi(
    () =>
    batchId ?
    Promise.all(
      COUNTED.map((code) =>
      api.transactions.
      list({ batchId, status: code, ...monthQuery(month), size: 1 }).
      then((result) => result.page.totalElements)
      )
    ) :
    Promise.resolve(null),
    [batchId, month]
  );

  const rows = listQ.data?.items ?? [];
  const counts = countsQ.data;
  const filters = STATUS_FILTERS.map((option) => ({
    ...option,
    count: counts ?
    option.value === 'ALL' ?
    counts.reduce((sum, count) => sum + count, 0) :
    counts[COUNTED.indexOf(option.value)] :
    undefined
  }));
  const filtered = status !== 'ALL' || month !== ALL_MONTHS;

  // 마지막 행을 제외하면 그 페이지가 비는데 Pagination 이 사라져 되돌아갈 수 없다
  useEffect(() => {
    if (page > 0 && listQ.data && listQ.data.items.length === 0) setPage(0);
  }, [page, listQ.data]);

  const resetFilters = () => {
    setStatus('ALL');
    setMonth(ALL_MONTHS);
    setPage(0);
    setError(null);
  };

  const change = async (row: Transaction, next: 'INCLUDED' | 'EXCLUDED') => {
    if (busyId) return;
    setBusyId(row.id);
    setError(null);
    try {
      if (next === 'INCLUDED') await api.transactions.include(row.id);else
      await api.transactions.exclude(row.id);
      if (next === 'INCLUDED')
      setRerunNeeded((prev) =>
      prev === 'classify' || row.classificationStatus.code !== 'CLASSIFIED' ? 'classify' : 'run'
      );
      listQ.reload();
      countsQ.reload();
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError ?
        caught.message :
        '상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setBusyId(null);
    }
  };

  /**
   * 판정 대상 칸. 상태는 늘 같은 배지로, 바꾸는 동작은 늘 같은 버튼으로 보인다.
   * 취소상계는 바꿀 수 없어 버튼 자리를 비워 두고, 배지가 다른 행과 같은 줄에 서게 한다.
   * 좁은 화면에서는 가맹점 칸 아래로 옮긴다
   */
  const inclusion = (row: Transaction) => {
    const canceled = row.sourceStatus.code === 'CANCELED_OFFSET';
    const excluded = row.effectiveStatus.code === 'EXCLUDED';
    return (
      <span className="inline-flex items-center gap-3">
        <Badge>{row.effectiveStatus.label}</Badge>
        {canceled ?
        <span aria-hidden="true" className="w-[6.5rem]" /> :

        <Button
          variant="secondary"
          size="sm"
          className="w-[6.5rem] px-0"
          disabled={busyId === row.id}
          onClick={() => void change(row, excluded ? 'INCLUDED' : 'EXCLUDED')}>

            {excluded ? '다시 넣기' : '빼기'}
          </Button>
        }
      </span>);

  };

  const columns: Column<Transaction>[] = [
  {
    header: '승인일',
    width: 'w-[7.5rem]',
    // 좁은 화면에서는 표가 옆으로 밀려 「제외하기」가 화면 밖으로 나간다. 날짜는 가맹점 칸으로 옮긴다
    hideBelow: 'sm',
    cell: (row) =>
    <span className="whitespace-nowrap tabular-nums text-ink2">
          {formatFullDate(row.approvedAt)}
        </span>

  },
  {
    header: '가맹점',
    // 남는 폭을 가맹점이 갖고 넘치면 말줄임한다. 나머지 칸은 줄을 바꾸지 않는다 (C71)
    width: 'w-full max-w-0',
    cell: (row) =>
    <span className="block min-w-0">
          <span className="block truncate font-normal text-ink">{merchantTitle(row)}</span>
          <span className="block whitespace-nowrap text-small tabular-nums text-muted sm:hidden">
            {formatFullDate(row.approvedAt)}
          </span>
          {/* 분류 열은 좁은 화면에서 숨기므로, 그 정보를 여기로 옮긴다 */}
          {needsCategory(row) ?
      <span className="mt-1 block md:hidden">
              <Badge>분류 필요</Badge>
            </span> :
      row.classificationStatus.code === 'CLASSIFIED' &&
      <span className="block truncate text-small text-ink2 md:hidden">{categoryLabel(row.merchantCategory)}</span>
      }
          <span className="mt-2 block sm:hidden">{inclusion(row)}</span>
        </span>

  },
  {
    header: '분류',
    hideBelow: 'md',
    width: 'w-32',
    cell: (row) =>
    needsCategory(row) ?
    <Badge>분류 필요</Badge> :
    row.classificationStatus.code === 'CLASSIFIED' ?
    <span className="whitespace-nowrap text-ink2">{categoryLabel(row.merchantCategory)}</span> :
    <span className="text-muted">—</span>

  },
  {
    header: '금액',
    align: 'right',
    width: 'w-32',
    cell: (row) =>
    <span className="block whitespace-nowrap">
          <span className="font-bold text-ink">{formatWon(row.amount)}</span>
          {row.installmentMonths > 0 &&
      <span className="block text-caption text-muted">
              {row.installmentMonths}개월 할부
            </span>
      }
        </span>

  },
  {
    header: '판정 대상',
    align: 'right',
    width: 'w-56',
    hideBelow: 'sm',
    cell: (row) => inclusion(row)
  }];


  return (
    <AppShell>
      <header>
        <h1 className="text-h2 font-bold tracking-tight text-ink">거래</h1>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          name="판정 대상 상태"
          value={status}
          onChange={(next) => {
            setStatus(next);
            setPage(0);
            setError(null);
          }}
          options={filters} />

        {months.length <= MONTH_BUTTONS_MAX ?
        <FilterBar
          name="달"
          value={month}
          onChange={(next) => {
            setMonth(next);
            setPage(0);
          }}
          options={[{ value: ALL_MONTHS, label: '전체 기간' }, ...months]} /> :

        // 달이 많으면 버튼 대신 펼침 목록이다. 모양은 위 필터 버튼과 같은 크기, 같은 글자다
        <label className="relative inline-flex items-center">
            <span className="sr-only">달</span>
            <select
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setPage(0);
            }}
            className="h-9 cursor-pointer appearance-none rounded-lg border border-edge bg-canvas pl-3 pr-8 text-small font-bold text-ink transition-colors duration-150 ease-snap hover:bg-surface">
              <option value={ALL_MONTHS}>전체 기간</option>
              {months.map((option) =>
            <option key={option.value} value={option.value}>
                  {option.label}
                </option>
            )}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 h-4 w-4 text-ink2" aria-hidden="true" />
          </label>
        }
      </div>

      {/* 아래쪽 행에서 바꾸면 안내가 화면 밖에 생겨 보이지 않으므로 머리말 아래에 붙여 둔다.
          표 위를 지나가므로 흰 바탕에 테두리를 둔다 */}
      <div className="sticky top-[76px] z-20">
        {/* 비어 있어도 DOM 에 남아 있어야 바뀐 내용을 읽는다 */}
        <div role="status">
          {rerunNeeded &&
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
              <p className="text-small leading-6 text-ink">
                {rerunNeeded === 'classify' ?
              '분류가 안 된 거래가 있습니다. 분류 확인을 마친 뒤 판정을 새로 실행해야 결과에 반영됩니다.' :
              '다시 포함한 거래는 판정을 새로 실행해야 결과에 반영됩니다.'}
              </p>
              {rerunNeeded === 'classify' ?
            <Button to="/preview" size="sm" variant="secondary" className="whitespace-nowrap">
                  분류 확인하기
                </Button> :

            <Button to="/confirm" size="sm" variant="secondary" className="whitespace-nowrap">
                  다시 판정하기
                </Button>
            }
            </div>
          }
        </div>
        {error &&
        <p role="alert" className="mt-4 rounded-xl border border-line bg-canvas px-4 py-3 text-small text-deny">
            {error}
          </p>
        }
      </div>

      <div className="mt-4">
        <Table
          caption="거래 목록"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={batchStatus === 'loading' || listQ.loading}
          empty={
          batchStatus === 'error' ?
          <Empty
            tone="error"
            icon={<SearchXIcon className="h-5 w-5" />}
            title="업로드 목록을 불러오지 못했습니다"
            action={
            <Button size="sm" variant="secondary" onClick={reloadBatch}>
                    다시 시도
                  </Button>
            } /> :

          listQ.error ?
          <Empty
            tone="error"
            icon={<SearchXIcon className="h-5 w-5" />}
            title="거래를 불러오지 못했습니다"
            action={
            <Button size="sm" variant="secondary" onClick={listQ.reload}>
                    다시 시도
                  </Button>
            } /> :

          !batchId ?
          <Empty
            icon={<SearchXIcon className="h-5 w-5" />}
            title="아직 올린 카드내역이 없습니다"
            action={
            <Button to="/upload" size="sm">
                    카드내역 올리기
                  </Button>
            } /> :

          filtered ?
          <Empty
            inTable
            icon={<SearchXIcon className="h-5 w-5" />}
            title="이 조건에 맞는 거래가 없습니다"
            action={
            <Button size="sm" variant="secondary" onClick={resetFilters}>
                    필터 초기화
                  </Button>
            } /> :

          <Empty
            icon={<SearchXIcon className="h-5 w-5" />}
            title="이 파일에는 거래가 없습니다"
            action={
            <Button to="/uploads" size="sm" variant="secondary">
                  업로드 이력
                </Button>
            } />

          } />


        {listQ.data && rows.length > 0 &&
        <Pagination page={listQ.data.page} onChange={setPage} />

        }
      </div>
    </AppShell>);

}
