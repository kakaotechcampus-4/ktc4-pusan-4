import { useEffect, useState } from 'react';
import { SearchXIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { api, ApiRequestError, useApi } from '../api';
import { useSession } from '../contexts/SessionContext';
import {
  Badge,
  Button,
  Empty,
  FilterBar,
  Pagination,
  Select,
  Table,
  type Column } from
'../components/ui';
import type { EffectiveStatus, Transaction } from '../types/domain';
import { formatFullDate, formatNumber, formatWon } from '../utils/format';

type StatusFilter = 'ALL' | EffectiveStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
{ value: 'ALL', label: '전체' },
{ value: 'JUDGEABLE', label: '판정대상' },
{ value: 'EXCLUDED', label: '대상제외' },
{ value: 'CANCELED_OFFSET', label: '취소상계' }];


const MONTHS = ['전체', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

/**
 * 3.4 거래 목록.
 * 판정 대상에서 빼고 넣는 화면이다. 취소상계는 파서가 정하므로 사용자가 바꿀 수 없다(2.3).
 */
export function Transactions() {
  const { batchId } = useSession();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [month, setMonth] = useState(0);
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQ = useApi(
    () =>
    api.transactions.list({
      batchId: batchId ?? undefined,
      status: status === 'ALL' ? undefined : status,
      month: month === 0 ? undefined : month,
      page,
      size: 20
    }),
    [batchId, status, month, page]
  );

  const rows = listQ.data?.items ?? [];

  // 마지막 행을 제외하면 그 페이지가 비는데 Pagination 이 사라져 되돌아갈 수 없다
  useEffect(() => {
    if (page > 0 && listQ.data && listQ.data.items.length === 0) setPage(0);
  }, [page, listQ.data]);

  const change = async (row: Transaction, next: 'INCLUDED' | 'EXCLUDED') => {
    if (busyId) return;
    setBusyId(row.id);
    setError(null);
    try {
      if (next === 'INCLUDED') await api.transactions.include(row.id);else
      await api.transactions.exclude(row.id);
      listQ.reload();
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

  const columns: Column<Transaction>[] = [
  {
    header: '승인일',
    width: 'w-[7.5rem]',
    cell: (row) =>
    <span className="whitespace-nowrap tabular-nums text-ink2">
          {formatFullDate(row.approvedAt)}
        </span>

  },
  {
    header: '가맹점',
    cell: (row) =>
    <span className="block min-w-0">
          <span className="block truncate font-medium text-ink">{row.merchantNorm}</span>
          <span className="block truncate text-small text-muted">{row.merchantRaw}</span>
          {/* 분류 열은 좁은 화면에서 숨기므로, 그 정보를 여기로 옮긴다 */}
          <span className="mt-1 block md:hidden">
            {row.classificationStatus.code === 'CLASSIFIED' ?
          <span className="text-small text-muted">{row.merchantCategory}</span> :
          <Badge tone="warn" size="sm">{row.classificationStatus.label}</Badge>}
          </span>
        </span>

  },
  {
    header: '분류',
    hideBelow: 'md',
    width: 'w-32',
    cell: (row) =>
    row.classificationStatus.code === 'CLASSIFIED' ?
    <span className="text-ink2">{row.merchantCategory}</span> :
    <Badge tone="warn">{row.classificationStatus.label}</Badge>

  },
  {
    header: '금액',
    align: 'right',
    width: 'w-32',
    cell: (row) =>
    <span className="block">
          <span className="font-semibold text-ink">{formatWon(row.amount)}</span>
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
    width: 'w-40',
    cell: (row) => {
      const canceled = row.sourceStatus.code === 'CANCELED_OFFSET';
      const excluded = row.effectiveStatus.code === 'EXCLUDED';
      if (canceled) {
        return (
          <span className="inline-flex items-center gap-1.5">
              <Badge>{row.sourceStatus.label}</Badge>
            </span>);

      }
      return (
        <Button
          variant={excluded ? 'secondary' : 'ghost'}
          size="sm"
          disabled={busyId === row.id}
          onClick={() => void change(row, excluded ? 'INCLUDED' : 'EXCLUDED')}>

            {excluded ? '다시 포함' : '제외하기'}
          </Button>);

    }
  }];


  return (
    <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-small font-semibold text-accent">거래</p>
          <h1 className="mt-1.5 text-h2 font-bold tracking-tight text-ink">
            올린 카드내역
          </h1>
          <p className="mt-2 max-w-2xl text-body leading-6 text-ink2">
            명백한 개인 지출은 여기서 빼두면 판정에서 제외됩니다. 취소·상계된 거래는
            파서가 판별하므로 바꿀 수 없습니다.
          </p>
        </div>
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
          options={STATUS_FILTERS} />

        <div className="w-32">
          <Select
            aria-label="월 선택"
            value={String(month)}
            onChange={(event) => {
              setMonth(Number(event.target.value));
              setPage(0);
            }}>

            {MONTHS.map((label, index) =>
            <option key={label} value={index}>
                {label}
              </option>
            )}
          </Select>
        </div>
      </div>

      {error &&
      <p
        role="alert"
        className="mt-4 rounded-xl border border-deny-line bg-deny-bg px-4 py-3 text-body text-deny">

          {error}
        </p>
      }

      <div className="mt-4">
        <Table
          caption="올린 카드내역 목록"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={listQ.loading}
          empty={
          listQ.error ?
          <Empty
            icon={<SearchXIcon className="h-5 w-5" />}
            title="거래를 불러오지 못했습니다"
            description="잠시 후 다시 시도해 주세요. 계속 안 되면 새로고침해 주세요."
            action={
            <Button size="sm" variant="secondary" onClick={listQ.reload}>
                    다시 시도
                  </Button>
            } /> :

          <Empty
            icon={<SearchXIcon className="h-5 w-5" />}
            title="이 조건에 맞는 거래가 없습니다"
            description="필터를 바꾸거나 카드내역을 먼저 올려 주세요."
            action={
            <Button to="/upload" size="sm" variant="secondary">
                  카드내역 올리기
                </Button>
            } />

          } />


        {listQ.data && rows.length > 0 &&
        <Pagination
          page={listQ.data.page}
          onChange={setPage}
          note={`${formatNumber(listQ.data.page.totalElements)}건 중 ${formatNumber(rows.length)}건 표시`} />

        }
      </div>
    </AppShell>);

}
