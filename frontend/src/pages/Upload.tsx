import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  FileSpreadsheetIcon,
  Loader2Icon,
  UploadCloudIcon } from
'lucide-react';
import { AppShell } from '../components/AppShell';
import { StepEyebrow } from '../components/StepEyebrow';
import { Badge, Button, Table, cn, type Column } from '../components/ui';
import { useSession } from '../contexts/SessionContext';
import { api, ApiRequestError, isMock } from '../api';
import { parseCardFile, sampleFiles } from '../parser';
import type {
  BlockedOutcome,
  ParsedOutcome,
  ParsedRow,
  SampleFile,
  UnsendableCode,
  UnsendableRow } from
'../parser';
import type { SourceStatus, UploadBatchCreated, UploadBatchRequest } from '../types/domain';
import { ISSUER_LABEL, uploadName } from '../copy';
import { formatFullDate, formatNumber, formatPeriod, formatWon } from '../utils/format';
import {
  APPROVAL_EXPORT_STEPS,
  ASSISTANT_DESTINATION,
  ASSISTANT_DOES_NOT_SEND,
  ASSISTANT_SENDS } from
'../components/assistant/help';

/** 실제 파일은 25–103KB 다. 5MB 면 몇 년치라 브라우저에서 바로 읽어도 느리지 않다 */
const MAX_BYTES = 5 * 1024 * 1024;

const PICK_ERROR = {
  many: '파일은 한 번에 하나만 올릴 수 있습니다.',
  large: '5MB를 넘는 파일은 읽지 않습니다. 조회 기간을 나눠 내려받아 주세요.',
  empty: '빈 파일입니다. 카드사에서 다시 내려받아 주세요.',
  unreadable: '파일을 읽지 못했습니다. 손상됐을 수 있으니 카드사에서 다시 내려받아 주세요.'
};

const ISSUERS = `${ISSUER_LABEL.kb}, ${ISSUER_LABEL.ibk}`;

const UNSENT_REASON: Record<UnsendableCode, string> = {
  FOREIGN_ONLY: '원화 금액이 없는 해외 결제입니다',
  NO_DATE: '승인일이 없습니다',
  NO_AMOUNT: '금액이 없습니다',
  ZERO_AMOUNT: '0원 결제입니다',
  BLANK_MERCHANT: '가맹점명이 없습니다',
  APPROVAL_TOO_LONG: '승인번호가 너무 깁니다'
};

/** 해외이용금액은 달러다(KB 파일 머리 「해외이용금액($)」) */
const formatDollar = (amount: number) =>
`${amount.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}달러`;

/** 카드 모양 상자. 흰 바탕에 괘선만 두른다 */
const BOX = 'animate-rise rounded-2xl border border-line bg-canvas p-6';

type SendState = 'idle' | 'sending' | ApiRequestError;

/**
 * 화면 단계. Idempotency-Key 는 preview 에만 있다 — 다른 단계로 넘어가면(초기화·업로드 완료) 키도 함께 사라진다
 */
type Phase =
{kind: 'idle';error?: string;} |
{kind: 'parsing';file: File;} |
{kind: 'blocked';file: File;outcome: BlockedOutcome;} |
{kind: 'preview';file: File;outcome: ParsedOutcome;key: string;send: SendState;} |
{kind: 'ready';file: File;outcome: ParsedOutcome;created: UploadBatchCreated;};

const IDLE: Phase = { kind: 'idle' };

/**
 * 화면 단계는 화면 밖에 둔다. 단계 띠로 다른 화면에 갔다 와도 읽은 파일이 남고(C54),
 * 다른 화면에 가 있는 동안 끝난 업로드도 보던 업로드가 된다(C58). 새로고침하면 사라진다.
 * owner 가 아닌 계정에는 빈 화면을 보인다
 */
const draft = {
  owner: null as string | null,
  phase: IDLE as Phase,
  /** 새 파일·초기화마다 올린다. 그 전에 시작한 읽기·업로드의 결과는 버린다 */
  seq: 0,
  /** 연타로 두 번 보내지 않게 막는다 */
  sending: false,
  listeners: new Set<() => void>()
};

function subscribe(listener: () => void) {
  draft.listeners.add(listener);
  return () => {
    draft.listeners.delete(listener);
  };
}

/** 이 계정의 것으로 삼는다. 다른 계정이 남긴 읽기·업로드는 이어 가지 않는다 */
function claim(owner: string | null) {
  if (draft.owner === owner) return;
  draft.owner = owner;
  draft.phase = IDLE;
  draft.seq += 1;
  draft.sending = false;
}

function put(next: Phase) {
  draft.phase = next;
  draft.listeners.forEach((listener) => listener());
}

interface SendErrorView {
  message: string;
  /** 있으면 다시 보낼 수 있다. 버튼 문구 */
  retry?: string;
  /** 다시 보낼 때 새 키를 쓴다 */
  newKey?: boolean;
  /** 업로드 이력으로 안내한다 */
  history?: boolean;
  /** 사용자가 고칠 수 없는 서버 쪽 실패라 추적 번호를 보인다. 신고할 때 쓴다 */
  trace?: boolean;
}

/**
 * 업로드 오류 → 문구와 다음 행동.
 * 응답을 못 받았거나 서버가 처리하지 못했으면 같은 키로 다시 보낸다. 서버가 첫 응답을 돌려주므로
 * 두 번 들어가지 않는다. 키가 이미 다른 요청에 쓰였거나 그 결과가 지워졌으면 새 키로 보낸다.
 */
function sendErrorView(error: ApiRequestError): SendErrorView {
  if (error.code === 'NETWORK_ERROR') {
    return {
      message: '서버에 연결하지 못했습니다. 올라갔는지 알 수 없지만 다시 보내도 두 번 들어가지 않습니다.',
      retry: '다시 시도'
    };
  }
  switch (error.code) {
    case 'DUPLICATE_FILE':
      return {
        message: '이미 올린 파일입니다. 업로드 이력에서 그 파일을 골라 이어서 볼 수 있습니다.',
        history: true
      };
    case 'IDEMPOTENCY_KEY_REUSED':
      return {
        message: '앞서 보낸 요청과 내용이 달라 거절됐습니다. 새 요청으로 다시 보낼 수 있습니다.',
        retry: '새 요청으로 올리기',
        newKey: true
      };
    case 'IDEMPOTENCY_RESULT_DELETED':
      return {
        message: '이 파일로 만든 업로드는 이미 지워졌습니다. 새 업로드로 다시 올릴 수 있습니다.',
        retry: '다시 올리기',
        newKey: true
      };
    case 'VALIDATION_ERROR':
    case 'MISSING_NATURAL_KEY':
      // 파일을 읽는 쪽(src/parser) 문제다. 서버 문구는 개발용이라 보이지 않는다
      return { message: '서버가 이 파일의 거래를 받지 않았습니다. 버그 신고로 알려 주세요.' };
  }
  if (error.status >= 500 || error.code === 'UNKNOWN') {
    return {
      message: '서버가 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      retry: '다시 시도',
      trace: true
    };
  }
  return { message: `올리지 못했습니다. ${error.message}` };
}

/**
 * 카드내역 올리기. 몇 단계인지는 STEPS 가 정한다(components/steps.tsx)
 * 파일은 이 브라우저 안에서 읽고(src/parser), 판정에 필요한 항목만 POST /upload-batches 로 보낸다.
 */
export function Upload() {
  const { userId, setBatchId } = useSession();
  const phase = useSyncExternalStore(
    subscribe,
    () => draft.owner === userId ? draft.phase : IDLE,
    () => IDLE
  );

  // 결과를 보고 떠났으면 다음에는 빈 화면으로 시작한다. 읽기만 한 파일과 올리는 중인 요청은 남긴다
  useEffect(() => () => {
    if (draft.phase.kind === 'ready') draft.phase = IDLE;
  }, []);

  // 드롭존 밖에 떨어뜨려도 브라우저가 파일을 열어 화면을 떠나지 않게 한다. 미리보기 · 결과 단계에서도 막는다
  useEffect(() => {
    const block = (event: DragEvent) => event.preventDefault();
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  const start = async (file: File) => {
    const mine = ++draft.seq;
    put({ kind: 'parsing', file });
    try {
      const outcome = await parseCardFile(file);
      if (mine !== draft.seq) return;
      put(
        outcome.kind === 'blocked' ?
        { kind: 'blocked', file, outcome } :
        { kind: 'preview', file, outcome, key: crypto.randomUUID(), send: 'idle' }
      );
    } catch {
      if (mine !== draft.seq) return;
      put({ kind: 'idle', error: PICK_ERROR.unreadable });
    }
  };

  const pick = (files: ArrayLike<File>) => {
    claim(userId);
    if (files.length !== 1) return put({ kind: 'idle', error: PICK_ERROR.many });
    const file = files[0];
    if (file.size === 0) return put({ kind: 'idle', error: PICK_ERROR.empty });
    if (file.size > MAX_BYTES) return put({ kind: 'idle', error: PICK_ERROR.large });
    void start(file);
  };

  const reset = () => {
    claim(userId);
    draft.seq += 1;
    // 버린 업로드가 끝나기를 기다리지 않고 다음 파일을 보낼 수 있게 한다
    draft.sending = false;
    put(IDLE);
  };

  const send = async () => {
    if (phase.kind !== 'preview' || draft.sending) return;
    const { file, outcome, key } = phase;
    const request = outcome.request;
    if (!request) return;
    const mine = draft.seq;
    draft.sending = true;
    put({ ...phase, send: 'sending' });
    try {
      const created = await api.uploads.create(request, key);
      // 다른 화면으로 갔어도 받는다. 새 파일을 고르거나 초기화했을 때만 버린다
      if (mine !== draft.seq) return;
      // 모두 중복이면 거래 없는 배치다. 세션을 바꾸지 않고 업로드 이력으로 안내한다
      if (created.transactionCount > 0) setBatchId(created.id);
      put({ kind: 'ready', file, outcome, created });
    } catch (caught) {
      if (mine !== draft.seq) return;
      const error =
      caught instanceof ApiRequestError ?
      caught :
      new ApiRequestError(0, 'UNKNOWN', '요청을 처리하지 못했습니다.');
      const view = sendErrorView(error);
      put({
        kind: 'preview',
        file,
        outcome,
        key: view.newKey ? crypto.randomUUID() : key,
        send: error
      });
    } finally {
      if (mine === draft.seq) draft.sending = false;
    }
  };

  return (
    <AppShell>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <header>
            <StepEyebrow>카드내역 올리기</StepEyebrow>
            <h1 className="mt-1.5 text-h2 font-bold tracking-tight text-ink">
              카드내역 올리기
            </h1>
          </header>

          <div className="mt-6">
            {phase.kind === 'idle' &&
            <div className="animate-rise">
                <DropZone onFiles={pick} invalid={phase.error !== undefined} />
                {phase.error &&
              <p role="alert" className="mt-3 text-body text-deny">
                    {phase.error}
                  </p>
              }
                <SampleList onPick={(file) => pick([file])} />
              </div>
            }

            {phase.kind === 'parsing' && <ParsingCard file={phase.file} />}

            {phase.kind === 'blocked' &&
            <BlockedCard file={phase.file} outcome={phase.outcome} onReset={reset} />
            }

            {phase.kind === 'preview' &&
            <PreviewCard
              file={phase.file}
              outcome={phase.outcome}
              send={phase.send}
              onSend={() => void send()}
              onReset={reset} />

            }

            {phase.kind === 'ready' &&
            <ReadyCard outcome={phase.outcome} created={phase.created} onReset={reset} />
            }
          </div>
        </div>

        <DataBoundary />
      </div>
    </AppShell>);

}

/** 파일 드롭존. 이 화면에서만 쓰여 ui/ 로 뽑지 않았다 (DESIGN.md) */
function DropZone({ onFiles, invalid }: {onFiles: (files: ArrayLike<File>) => void;invalid: boolean;}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onFiles(event.dataTransfer.files);
      }}
      className={cn(
        'rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors duration-150 ease-snap',
        dragging ? 'border-accent bg-accent-soft' : invalid ? 'border-deny bg-canvas' : 'border-edge bg-canvas'
      )}>

      <UploadCloudIcon className="mx-auto h-8 w-8 text-ink2" aria-hidden="true" />
      <p className="mt-3 text-body-lg font-bold text-ink">
        승인내역 파일을 여기에 끌어다 놓으세요
      </p>
      <p className="mt-1 text-body text-ink2">{ISSUERS} 승인내역 .xls 파일</p>
      <Button className="mt-5 whitespace-nowrap" onClick={() => input.current?.click()}>
        파일 선택
      </Button>
      {/* 고르는 창의 힌트일 뿐이다. 확장자로 거르지 않고 내용으로 판별한다 */}
      <input
        ref={input}
        type="file"
        accept=".xls"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => {
          const files = event.target.files;
          if (files && files.length > 0) onFiles(Array.from(files));
          // 같은 파일을 다시 골라도 change 가 오도록 비운다
          event.target.value = '';
        }} />

    </div>);

}

/**
 * 가짜 거래로 만든 샘플. 시연할 때 올릴 파일이 있어야 해서 실서버에서도 보인다(#215).
 * 실서버에서는 올린 샘플이 그 계정의 업로드로 남는다
 */
function SampleList({ onPick }: {onPick: (file: File) => void;}) {
  const [samples, setSamples] = useState<SampleFile[]>([]);

  useEffect(() => {
    let cancelled = false;
    sampleFiles().
    then((list) => {
      if (!cancelled) setSamples(list);
    }).
    catch(() => {
      // 샘플을 만들지 못하면 목록을 그리지 않는다
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (samples.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-body font-bold text-ink">샘플 파일로 해 보기</h2>
      {!isMock && <p className="mt-1 text-body text-ink2">올리면 업로드 이력에 남습니다.</p>}
      <ul className="mt-3 space-y-2">
        {samples.map((sample) =>
        <li key={sample.id}>
            <button
            type="button"
            onClick={() => onPick(sample.file)}
            className="flex w-full items-center gap-3 rounded-xl border border-edge bg-canvas px-4 py-3 text-left transition-colors duration-150 ease-snap hover:bg-surface">

              <FileSpreadsheetIcon className="h-4 w-4 shrink-0 text-ink2" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-body text-ink">{sample.label}</span>
              <ArrowRightIcon className="h-4 w-4 shrink-0 text-ink2" aria-hidden="true" />
            </button>
          </li>
        )}
      </ul>
    </section>);

}

function ParsingCard({ file }: {file: File;}) {
  return (
    <section className={BOX} aria-busy="true">
      <div className="flex items-center gap-2.5">
        <Loader2Icon className="h-4 w-4 animate-spin text-ink2" aria-hidden="true" />
        <h2 className="text-body-lg font-bold text-ink">파일을 읽고 있습니다</h2>
      </div>
      <p className="mt-1.5 break-all text-body text-ink2">{file.name}</p>
    </section>);

}

/** 보조 동작이 앞, 주 동작이 뒤에 오고 오른쪽에 붙는다 (C90) */
function Actions({ children }: {children: React.ReactNode;}) {
  return <div className="mt-6 flex flex-wrap items-center justify-end gap-3">{children}</div>;
}

/** 어느 카드사의 언제 내역인지. 업로드 이력·판정 전 확인과 같은 이름을 쓴다 (C59) */
function Identity({ request }: {request: UploadBatchRequest;}) {
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 text-body text-ink2">
      <span>{uploadName(request)}</span>
      <span className="tabular-nums">{formatPeriod(request.periodStart, request.periodEnd)}</span>
    </p>);

}

function BlockedCard({
  file,
  outcome,
  onReset



}: {file: File;outcome: BlockedOutcome;onReset: () => void;}) {
  const billing = outcome.statement === '청구내역';
  return (
    <section className={BOX}>
      <p className="break-all text-caption text-muted">{file.name}</p>
      <h2 className="mt-1 flex items-center gap-2 text-h4 font-bold text-ink">
        <AlertTriangleIcon className="h-5 w-5 shrink-0 text-deny" aria-hidden="true" />
        {billing ? '청구내역은 판정할 수 없습니다' : '읽을 수 없는 파일입니다'}
      </h2>
      <p className="mt-2 max-w-xl text-body text-ink2">
        {billing ?
        '청구내역은 할부가 회차마다 나뉘어 있어 판정이 틀릴 수 있습니다. 같은 기간의 승인내역을 내려받아 올려 주세요.' :
        `${ISSUERS}에서 내려받은 승인내역 .xls 파일만 읽을 수 있습니다. 파일을 고치지 말고 그대로 올려 주세요.`}
      </p>
      {billing &&
      <p className="mt-3 max-w-xl text-body text-ink2">
          <span className="mr-2 font-bold text-ink">승인내역 받는 방법</span>
          {APPROVAL_EXPORT_STEPS}
        </p>
      }
      <Actions>
        <Button className="whitespace-nowrap" onClick={onReset}>다른 파일 올리기</Button>
      </Actions>
    </section>);

}

function PreviewCard({
  file,
  outcome,
  send,
  onSend,
  onReset






}: {file: File;outcome: ParsedOutcome;send: SendState;onSend: () => void;onReset: () => void;}) {
  const { request, stats, rows, unsendable } = outcome;
  const sent = request?.transactions ?? [];
  const error = send instanceof ApiRequestError ? send : null;
  const view = error ? sendErrorView(error) : null;
  // 같은 요청은 같은 오류로 끝나므로, 다시 보낼 수 있는 오류에서만 버튼을 살린다
  const canSend = request !== null && send !== 'sending' && (view === null || view.retry !== undefined);

  const counts = [
  { term: '읽은 행', value: rows.length },
  { term: '보낼 거래', value: sent.length },
  { term: '보내지 않는 행', value: unsendable.length }];


  /**
   * 보낼 거래만 상태별로 센다. 셋을 더하면 보낼 거래이고 판정대상이 판정에 들어가는 수다 (C37).
   * 보내지 않는 행까지 세면 판정대상이 판정 화면의 건수보다 많아진다
   */
  const sentWith = (status: SourceStatus) => sent.filter((t) => t.status === status).length;
  const breakdown = ([
  ['판정대상', sentWith('JUDGEABLE')],
  ['취소상계', sentWith('CANCELED_OFFSET')],
  ['대상제외', sentWith('EXCLUDED')]] as const).
  filter(([term, n]) => term === '판정대상' || n > 0).
  map(([term, n]) => `${term} ${formatNumber(n)}건`);

  // 사용자가 할 일이 있는 안내만 둔다. 0건인 안내는 그리지 않는다
  const notes = ([
  [
  stats.cancelsAmbiguous,
  (n: string) =>
  `취소 ${n}건은 같은 가맹점, 같은 금액의 결제가 여러 건이라 어느 결제의 취소인지 정하지 못했습니다. 취소된 결제를 거래 화면에서 판정 대상에서 빼 주세요.`],

  [
  stats.cancelsUnpaired - stats.cancelsOutOfWindow,
  (n: string) =>
  `취소 ${n}건은 이 파일에서 원래 결제를 찾지 못했습니다. 앞서 올린 파일의 결제라면 거래 화면에서 판정 대상에서 빼 주세요.`],

  [
  stats.cancelsOutOfWindow,
  (n: string) =>
  `취소 ${n}건은 같은 가맹점, 같은 금액의 결제와 62일 넘게 떨어져 있어 짝짓지 않았습니다. 환불된 결제라면 거래 화면에서 판정 대상에서 빼 주세요.`],

  [
  stats.foreignOnly,
  (n: string) =>
  `해외 결제 ${n}건은 원화 금액이 없어 판정에 넣지 못합니다. 원화로 바뀐 뒤 다시 내려받거나 세무사에게 따로 알려 주세요.`]] as
  const).
  filter(([n]) => n > 0).
  map(([n, text]) => text(formatNumber(n)));

  const merchantCell = (merchant: string) =>
  <span className="block max-w-xs truncate whitespace-nowrap" title={merchant || undefined}>
      {merchant || '—'}
    </span>;


  const unsentColumns: Column<UnsendableRow>[] = [
  { header: '승인일', cell: (u) => <span className="whitespace-nowrap tabular-nums">{u.row.approvedAt ? formatFullDate(u.row.approvedAt) : '—'}</span> },
  { header: '가맹점명', cell: (u) => merchantCell(u.row.rawMerchant) },
  {
    header: '금액',
    align: 'right',
    cell: (u) =>
    <span className="whitespace-nowrap">
        {u.row.foreignAmount !== null ?
      formatDollar(u.row.foreignAmount) :
      u.row.amount === null ?
      '—' :
      formatWon(u.row.amount)}
      </span>

  },
  { header: '이유', cell: (u) => <span className="whitespace-nowrap">{UNSENT_REASON[u.code]}</span> }];


  // 보내지 않는 행은 위 표에 따로 있다. 여기에는 서버로 갈 행만 보인다
  const unsentIndex = new Set(unsendable.map((u) => u.index));
  const head = rows.filter((_, index) => !unsentIndex.has(index)).slice(0, 10);
  const rowColumns: Column<ParsedRow>[] = [
  { header: '승인일', cell: (r) => <span className="whitespace-nowrap tabular-nums">{r.approvedAt ? formatFullDate(r.approvedAt) : '—'}</span> },
  { header: '가맹점명', cell: (r) => merchantCell(r.rawMerchant) },
  {
    header: '금액',
    align: 'right',
    cell: (r) => <span className="whitespace-nowrap">{r.amount === null ? '—' : formatWon(r.amount)}</span>
  },
  { header: '상태', cell: (r) => <Badge>{r.status}</Badge> }];


  return (
    <section className={BOX}>
      <p className="break-all text-caption text-muted">{file.name}</p>
      <h2 className="mt-1 text-h4 font-bold text-ink">
        {uploadName({ cardIssuer: outcome.issuer, sourceType: '승인내역' })}
      </h2>
      {request &&
      <p className="mt-1 text-body tabular-nums text-ink2">
          {formatPeriod(request.periodStart, request.periodEnd)}
        </p>
      }

      <dl aria-label="파일에서 읽은 결과" className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
        {counts.map((item) =>
        <div key={item.term}>
            <dt className="text-body text-ink2">{item.term}</dt>
            <dd className="mt-0.5 text-h4 font-bold tabular-nums text-ink">
              <data value={item.value}>{formatNumber(item.value)}건</data>
            </dd>
          </div>
        )}
      </dl>
      {sent.length > 0 &&
      <p className="mt-2 text-body text-ink2">
          보낼 거래 {formatNumber(sent.length)}건 중 {breakdown.join(', ')}
        </p>
      }

      {notes.length > 0 &&
      <ul className="mt-5 space-y-2 text-body text-ink2">
          {notes.map((note) =>
        <li key={note}>{note}</li>
        )}
        </ul>
      }

      {unsendable.length > 0 &&
      <div className="mt-8">
          <h3 className="text-body font-bold text-ink">
            보내지 않는 행 {formatNumber(unsendable.length)}건
          </h3>
          <Table
          className="mt-3"
          caption="보내지 않는 행"
          columns={unsentColumns}
          rows={unsendable}
          rowKey={(u) => String(u.index)} />

        </div>
      }

      {head.length > 0 &&
      <div className="mt-8">
          <h3 className="text-body font-bold text-ink">
            보낼 거래 중 처음 {formatNumber(head.length)}건
          </h3>
          {/* caption 은 표가 무엇인지 적는다. 「처음 N건」은 보고 있는 범위지 표의 내용이 아니다 (접근성 보고서 2026-10-22) */}
          <Table
          className="mt-3"
          caption="서버로 보낼 카드내역"
          columns={rowColumns}
          rows={head}
          rowKey={(r) => String(rows.indexOf(r))} />

        </div>
      }

      {request === null && <p className="mt-6 text-body text-deny">보낼 수 있는 거래가 없습니다.</p>}

      {error && view &&
      <div role="alert" className="mt-6 text-body text-deny">
          <p>{view.message}</p>
          {view.trace && error.traceId &&
        <p className="mt-1 text-caption tabular-nums text-muted">추적 번호 {error.traceId}</p>
        }
          {view.history &&
        <Button className="mt-3" variant="secondary" size="sm" to="/uploads">
              업로드 이력 보기
            </Button>
        }
        </div>
      }

      <Actions>
        <Button variant="secondary" className="whitespace-nowrap" onClick={onReset}>
          다른 파일 올리기
        </Button>
        <Button className="whitespace-nowrap" disabled={!canSend} onClick={onSend}>
          {send === 'sending' ? '올리는 중…' : view?.retry ?? `${formatNumber(sent.length)}건 올리기`}
        </Button>
      </Actions>
    </section>);

}

/**
 * 다음에 갈 곳. 미분류 거래는 판정되지 않으므로 분류 확인이 먼저다.
 * 문진은 한 번 하면 되는 설정이라 이미 있으면 건너뛴다. 조회 중이거나 실패했으면 판정 전 확인이 다시 막는다 (C2)
 */
function nextStep(pending: number, hasNoContext: boolean) {
  if (pending > 0) return { to: '/preview', label: '다음: 분류 확인' };
  if (hasNoContext) return { to: '/interview', label: '다음: 사업자 문진' };
  return { to: '/confirm', label: '다음: 판정 전 확인' };
}

function ReadyCard({
  outcome,
  created,
  onReset



}: {outcome: ParsedOutcome;created: UploadBatchCreated;onReset: () => void;}) {
  const { contextStatus } = useSession();
  const { request } = outcome;

  if (created.transactionCount === 0) {
    return (
      <section className={BOX}>
        <h2 className="text-h4 font-bold text-ink">새로 들어간 거래가 없습니다</h2>
        <p className="mt-2 text-body text-ink2">
          이 파일의 거래 {formatNumber(created.skippedDuplicateCount)}건은 모두 이미 올린 거래입니다.
        </p>
        <Actions>
          <Button variant="secondary" className="whitespace-nowrap" onClick={onReset}>
            다른 파일 올리기
          </Button>
          <Button className="whitespace-nowrap" to="/uploads">업로드 이력 보기</Button>
        </Actions>
      </section>);

  }

  const pending = created.classificationPendingCount;
  const next = nextStep(pending, contextStatus === 'none');
  return (
    <section className={BOX}>
      <h2 className="text-h4 font-bold text-ink">
        {formatNumber(created.transactionCount)}건을 올렸습니다
      </h2>
      {request && <Identity request={request} />}
      {(created.skippedDuplicateCount > 0 || pending > 0) &&
      <ul className="mt-4 space-y-1.5 text-body text-ink2">
          {created.skippedDuplicateCount > 0 &&
        <li>중복된 거래 {formatNumber(created.skippedDuplicateCount)}건은 넣지 않았습니다.</li>
        }
          {pending > 0 && <li>가맹점 분류가 필요한 거래가 {formatNumber(pending)}건 있습니다.</li>}
        </ul>
      }
      <Actions>
        <Button variant="secondary" className="whitespace-nowrap" onClick={onReset}>
          다른 파일 올리기
        </Button>
        <Button className="whitespace-nowrap" to={next.to}>
          {next.label}
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      </Actions>
    </section>);

}

/** 무엇이 서버로 가고 무엇이 남는지. 업로드 요청에 실제로 담기는 필드와 같아야 한다 */
function DataBoundary() {
  return (
    <aside className="h-fit rounded-2xl border border-line bg-canvas p-5">
      <h2 className="text-body font-bold text-ink">데이터 경계</h2>
      <div className="mt-4 space-y-5 text-small text-ink2">
        <div>
          <p className="font-bold text-ink">서버로 보내는 것</p>
          <p className="mt-0.5">
            승인일, 가맹점명(의료 업종은 가림), 금액, 할부 개월, 승인번호, 가맹점
            사업자번호({ISSUER_LABEL.ibk}), 메모({ISSUER_LABEL.kb})
          </p>
          <p className="mt-1.5">
            카드사, 조회 기간, 판정에서 빼는 행과 그 이유, 같은 파일이나 같은 거래를 알아보는 값도 함께 보냅니다.
          </p>
        </div>
        <div>
          <p className="font-bold text-ink">브라우저에 남는 것</p>
          <p className="mt-0.5">원본 파일, 카드번호, 이용고객명, 이용카드명, 승인 시각</p>
        </div>
        <div>
          <p className="font-bold text-ink">로그에 남지 않는 것</p>
          <p className="mt-0.5">소득 금액, 이름</p>
        </div>
        <div>
          {/* QR-7. 비서 도구가 모델에 넘기는 필드에서 뽑았다. 목록은 AI 쪽이 확정한다(agent-secretary.md 10장) */}
          <p className="font-bold text-ink">Really에게 물을 때 외부 모델로 보내는 것</p>
          <p className="mt-0.5">{ASSISTANT_SENDS}</p>
          <p className="mt-1.5">{ASSISTANT_DOES_NOT_SEND} 묻지 않으면 보내지 않습니다.</p>
          <p className="mt-1.5">
            {ASSISTANT_DESTINATION}{' '}
            <Link to="/privacy" className="underline underline-offset-4 hover:text-ink">개인정보처리방침</Link>
          </p>
        </div>
      </div>
    </aside>);

}
