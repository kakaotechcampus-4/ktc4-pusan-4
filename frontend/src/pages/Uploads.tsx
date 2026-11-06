import { useEffect, useState } from 'react';
import { CheckIcon, InboxIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { api, ApiRequestError, useApi } from '../api';
import { useSession } from '../contexts/SessionContext';
import {
  Badge,
  Button,
  Empty,
  Modal,
  Pagination,
  Table,
  type Column } from
'../components/ui';
import { uploadName } from '../copy';
import type { UploadBatch } from '../types/domain';
import { formatFullDate, formatNumber, formatPeriod, toKst } from '../utils/format';

/** 올린 시각. 같은 날 같은 카드사 파일을 가르려면 시각까지 있어야 한다 (C59) */
const uploadedAt = (row: UploadBatch) => {
  const { date, time } = toKst(row.createdAt);
  return `${formatFullDate(date)} ${time}`;
};

/**
 * 업로드 이력 (FR-24·25).
 * 배치를 지우면 거래·판정·질문·사용자 수정까지 함께 사라진다(api.md 3.3). 지우기 전에 그걸 말한다.
 */
export function Uploads() {
  const { batchId, setBatchId, reloadBatch } = useSession();
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState<UploadBatch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listQ = useApi(() => api.uploads.list({ page, size: 20 }), [page]);
  const rows = listQ.data?.items ?? [];

  // 마지막 행을 지우면 그 페이지가 비는데 Pagination 이 사라져 되돌아갈 수 없다
  useEffect(() => {
    if (page > 0 && listQ.data && listQ.data.items.length === 0) setPage(0);
  }, [page, listQ.data]);

  const remove = async () => {
    if (!target) return;
    setDeleting(true);
    setError(null);
    try {
      await api.uploads.remove(target.id);
    } catch (caught) {
      // 응답을 못 받은 첫 요청이 이미 지웠으면 다시 보낸 요청은 404 다. 지워진 것으로 본다 (C50)
      if (!(caught instanceof ApiRequestError && caught.status === 404)) {
        setError(
          caught instanceof ApiRequestError ?
          caught.message :
          '삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.'
        );
        setDeleting(false);
        return;
      }
    }
    // 보던 업로드를 지웠으면 남은 것 가운데서 다시 고른다. 남은 것이 없을 때만 비어 있다 (C55)
    if (batchId === target.id) {
      setBatchId(null);
      reloadBatch();
    }
    setTarget(null);
    setDeleting(false);
    listQ.reload();
  };

  /** 보기·삭제. 좁은 화면에서는 파일 칸 아래로 옮긴다 (C73) */
  const actions = (row: UploadBatch) =>
  <span className="inline-flex items-center gap-2 whitespace-nowrap">
      {row.id === batchId ?
    <span className="inline-flex items-center gap-1 py-2 text-body font-bold text-accent">
          <CheckIcon aria-hidden="true" className="h-4 w-4" />
          보는 중
        </span> :

    <Button
      variant="secondary"
      size="sm"
      aria-label={`${uploadName(row)} ${formatPeriod(row.periodStart, row.periodEnd)} 보기`}
      onClick={() => setBatchId(row.id)}>

          이 파일 보기
        </Button>
    }
      <Button
      variant="ghost"
      size="sm"
      aria-label={`${uploadName(row)} ${formatPeriod(row.periodStart, row.periodEnd)} 업로드 삭제`}
      onClick={() => setTarget(row)}>

        삭제
      </Button>
    </span>;


  const columns: Column<UploadBatch>[] = [
  {
    header: '올린 날',
    width: 'w-[7.5rem]',
    hideBelow: 'md',
    cell: (row) => <span className="whitespace-nowrap tabular-nums text-ink2">{uploadedAt(row)}</span>
  },
  {
    header: '파일',
    // 남는 폭을 이 칸이 갖는다. 보기·삭제가 오른쪽 끝에 붙는다
    width: 'w-full',
    cell: (row) =>
    <span className="block whitespace-nowrap">
          <span className="block text-ink">{uploadName(row)}</span>
          <span className="block text-small tabular-nums text-ink2">
            {formatPeriod(row.periodStart, row.periodEnd)}
          </span>
          {/* 올린 날 열은 좁은 화면에서 숨기므로 여기로 옮긴다 */}
          <span className="block text-small tabular-nums text-muted md:hidden">{uploadedAt(row)}</span>
          {row.classificationPendingCount > 0 &&
      <span className="mt-1 block">
              <Badge>분류 필요 {formatNumber(row.classificationPendingCount)}건</Badge>
            </span>
      }
          <span className="mt-2 block md:hidden">{actions(row)}</span>
        </span>

  },
  {
    header: '거래',
    align: 'right',
    width: 'w-36',
    cell: (row) =>
    <span className="block whitespace-nowrap">
          <span className="font-bold tabular-nums text-ink">
            {formatNumber(row.transactionCount)}건
          </span>
          {row.skippedDuplicateCount > 0 &&
      <span className="block text-caption tabular-nums text-muted">
              중복 {formatNumber(row.skippedDuplicateCount)}건 제외
            </span>
      }
        </span>

  },
  {
    header: '',
    align: 'right',
    hideBelow: 'md',
    cell: actions
  }];


  return (
    <AppShell>
      <header>
        <h1 className="text-h2 font-bold tracking-tight text-ink">업로드 이력</h1>
      </header>

      <div className="mt-6">
        <Table
          caption="업로드 이력"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          selectedKey={batchId ?? undefined}
          loading={listQ.loading}
          empty={
          listQ.error ?
          <Empty
            icon={<InboxIcon className="h-5 w-5" />}
            title="업로드 이력을 불러오지 못했습니다"
            action={
            <Button size="sm" variant="secondary" onClick={listQ.reload}>
                    다시 시도
                  </Button>
            } /> :

          <Empty
            icon={<InboxIcon className="h-5 w-5" />}
            title="아직 올린 카드내역이 없습니다"
            action={
            <Button to="/upload" size="sm">
                  카드내역 올리기
                </Button>
            } />

          } />


        {listQ.data && rows.length > 0 &&
        <Pagination page={listQ.data.page} onChange={setPage} />
        }
      </div>

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        tone="danger"
        title="이 업로드를 지울까요?"
        description="되돌릴 수 없습니다. 이 파일에서 나온 거래와 판정 결과, 질문에 한 답, 직접 고친 판정까지 함께 사라집니다."
        footer={
        <>
            <Button
            variant="secondary"
            size="md"
            disabled={deleting}
            onClick={() => setTarget(null)}>

              취소
            </Button>
            <Button
            variant="danger"
            size="md"
            disabled={deleting}
            onClick={() => void remove()}>

              {deleting ? '지우는 중…' : '지우기'}
            </Button>
          </>
        }>

        {error &&
        <p role="alert" className="mb-4 text-body text-deny">
            {error}
          </p>
        }
        {target &&
        <dl className="space-y-1.5 rounded-xl bg-canvas p-4 text-small">
            <div className="flex justify-between gap-3">
              <dt className="text-ink2">파일</dt>
              <dd className="text-ink">{uploadName(target)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink2">기간</dt>
              <dd className="tabular-nums text-ink">
                {formatPeriod(target.periodStart, target.periodEnd)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink2">거래</dt>
              <dd className="tabular-nums text-ink">
                {formatNumber(target.transactionCount)}건
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink2">올린 날</dt>
              <dd className="tabular-nums text-ink">{uploadedAt(target)}</dd>
            </div>
          </dl>
        }
      </Modal>
    </AppShell>);

}
