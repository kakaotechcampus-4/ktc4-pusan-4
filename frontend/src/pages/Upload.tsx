import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  FileSpreadsheetIcon,
  Loader2Icon,
  UploadCloudIcon } from
'lucide-react';
import { AppShell } from '../components/AppShell';
import { Badge, Button, Table, cn, type Column } from '../components/ui';
import { useSession } from '../contexts/SessionContext';
import { api, ApiRequestError, isMock } from '../api';
import { parseCardFile, sampleFiles } from '../parser';
import type {
  BlockedCode,
  BlockedOutcome,
  ParsedOutcome,
  ParsedRow,
  SampleFile,
  SourceCard,
  UnsendableCode,
  UnsendableRow } from
'../parser';
import type { UploadBatchCreated } from '../types/domain';
import { formatNumber, formatPeriod, formatWon } from '../utils/format';
import { APPROVAL_EXPORT_STEPS, ASSISTANT_DOES_NOT_SEND, ASSISTANT_SENDS } from '../components/assistant/help';

/** 실제 파일은 25–103KB 다. 5MB 면 몇 년치라 브라우저에서 바로 읽어도 느리지 않다 */
const MAX_BYTES = 5 * 1024 * 1024;

const PICK_ERROR = {
  many: '파일은 한 번에 하나만 올릴 수 있습니다.',
  large: '5MB를 넘는 파일은 읽지 않습니다. 조회 기간을 나눠 내려받아 주세요.',
  empty: '빈 파일입니다. 카드사에서 다시 내려받아 주세요.',
  unreadable: '파일을 읽지 못했습니다. 손상됐을 수 있으니 카드사에서 다시 내려받아 주세요.'
};

const ISSUER: Record<SourceCard, string> = { kb: 'KB국민', ibk: 'IBK기업' };

/** 파서의 판별 근거(Python 문구)는 대조용이라 화면에는 코드별 문구를 쓴다 */
const BLOCKED_REASON: Record<BlockedCode, string> = {
  BILLING: '청구 컬럼이 있고 가맹점명이 없습니다.',
  MERCHANT_WITHOUT_APPROVAL: '가맹점명은 있지만 승인 정보 컬럼이 없습니다.',
  NO_COLUMNS: '가맹점명과 승인 정보 컬럼을 찾지 못했습니다.',
  UNKNOWN_FORMAT: '파일 형식을 알아보지 못했습니다.',
  UNREADABLE: '파일을 열지 못했습니다.'
};

const UNSENT_REASON: Record<UnsendableCode, string> = {
  NO_DATE: '승인일이 없습니다',
  NO_AMOUNT: '금액이 없습니다',
  BLANK_MERCHANT: '가맹점명이 없습니다',
  APPROVAL_TOO_LONG: '승인번호가 너무 깁니다'
};

type SendState = 'idle' | 'sending' | ApiRequestError;

/**
 * 화면 단계. Idempotency-Key 는 preview 에만 있다 — 다른 단계로 넘어가거나(초기화·업로드 완료)
 * 화면을 떠나면 키도 함께 사라진다.
 */
type Phase =
{kind: 'idle';error?: string;} |
{kind: 'parsing';file: File;} |
{kind: 'blocked';file: File;outcome: BlockedOutcome;} |
{kind: 'preview';file: File;outcome: ParsedOutcome;key: string;send: SendState;} |
{kind: 'ready';file: File;outcome: ParsedOutcome;created: UploadBatchCreated;};

interface SendErrorView {
  message: string;
  /** 있으면 다시 보낼 수 있다. 버튼 문구 */
  retry?: string;
  /** 다시 보낼 때 새 키를 쓴다 */
  newKey?: boolean;
  /** 업로드 이력으로 안내한다 */
  history?: boolean;
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
      return {
        message: `서버가 거래 형식을 받지 않았습니다. 파일을 읽는 쪽 문제일 수 있습니다. (${error.message})`
      };
  }
  if (error.status >= 500 || error.code === 'UNKNOWN') {
    return {
      message: '서버가 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      retry: '다시 시도'
    };
  }
  return { message: `올리지 못했습니다. ${error.message}` };
}

/**
 * 1단계 · 카드내역.
 * 파일은 이 브라우저 안에서 읽고(src/parser), 판정에 필요한 항목만 POST /upload-batches 로 보낸다.
 */
export function Upload() {
  const { setBatchId, setRunId } = useSession();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  /** 새 파일·초기화·화면 이탈마다 올린다. 늦게 끝난 읽기·업로드 결과는 버린다 */
  const seq = useRef(0);
  /** 연타로 두 번 보내지 않게 막는다 */
  const sending = useRef(false);

  useEffect(() => {
    const current = seq;
    return () => {
      current.current += 1;
    };
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
    const mine = ++seq.current;
    setPhase({ kind: 'parsing', file });
    try {
      const outcome = await parseCardFile(file);
      if (mine !== seq.current) return;
      setPhase(
        outcome.kind === 'blocked' ?
        { kind: 'blocked', file, outcome } :
        { kind: 'preview', file, outcome, key: crypto.randomUUID(), send: 'idle' }
      );
    } catch {
      if (mine !== seq.current) return;
      setPhase({ kind: 'idle', error: PICK_ERROR.unreadable });
    }
  };

  const pick = (files: ArrayLike<File>) => {
    if (files.length !== 1) return setPhase({ kind: 'idle', error: PICK_ERROR.many });
    const file = files[0];
    if (file.size === 0) return setPhase({ kind: 'idle', error: PICK_ERROR.empty });
    if (file.size > MAX_BYTES) return setPhase({ kind: 'idle', error: PICK_ERROR.large });
    void start(file);
  };

  const reset = () => {
    seq.current += 1;
    // 버린 업로드가 끝나기를 기다리지 않고 다음 파일을 보낼 수 있게 한다
    sending.current = false;
    setPhase({ kind: 'idle' });
  };

  const send = async () => {
    if (phase.kind !== 'preview' || sending.current) return;
    const { file, outcome, key } = phase;
    const request = outcome.request;
    if (!request) return;
    const mine = seq.current;
    sending.current = true;
    setPhase({ ...phase, send: 'sending' });
    try {
      const created = await api.uploads.create(request, key);
      if (mine !== seq.current) return;
      // 모두 중복이면 거래 없는 배치다. 세션을 바꾸지 않고 업로드 이력으로 안내한다
      if (created.transactionCount > 0) {
        setBatchId(created.id);
        // 이전 배치의 실행을 들고 있으면 /run 이 그 실행을 계속 폴링한다
        setRunId(null);
      }
      setPhase({ kind: 'ready', file, outcome, created });
    } catch (caught) {
      if (mine !== seq.current) return;
      const error =
      caught instanceof ApiRequestError ?
      caught :
      new ApiRequestError(0, 'UNKNOWN', '요청을 처리하지 못했습니다.');
      const view = sendErrorView(error);
      setPhase({
        kind: 'preview',
        file,
        outcome,
        key: view.newKey ? crypto.randomUUID() : key,
        send: error
      });
    } finally {
      if (mine === seq.current) sending.current = false;
    }
  };

  return (
    <AppShell>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <header>
            <p className="text-small font-bold text-accent">1단계 · 카드내역</p>
            <h1 className="mt-1.5 text-h2 font-bold tracking-tight text-ink">
              카드내역 올리기
            </h1>
            <p className="mt-2 max-w-2xl text-body text-ink2">
              카드사에서 내려받은 승인내역 파일을 이 브라우저 안에서 읽습니다. 원본 파일은
              보내지 않고, 판정에 필요한 항목만 보냅니다.
            </p>
          </header>

          <div className="mt-6">
            {phase.kind === 'idle' &&
            <div className="animate-rise">
                <DropZone onFiles={pick} />
                {phase.error &&
              <p
                role="alert"
                className="mt-4 rounded-xl border border-deny-line bg-deny-bg px-4 py-3 text-small text-deny">

                    {phase.error}
                  </p>
              }
                {isMock && <SampleList onPick={(file) => pick([file])} />}
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
function DropZone({ onFiles }: {onFiles: (files: ArrayLike<File>) => void;}) {
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
        dragging ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
      )}>

      <UploadCloudIcon className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
      <p className="mt-3 text-body-lg font-bold text-ink">
        승인내역 파일을 여기에 끌어다 놓으세요
      </p>
      <p className="mt-1 text-small text-muted">KB국민 · IBK기업 승인내역 .xls · 최대 5MB</p>
      <Button className="mt-5" onClick={() => input.current?.click()}>
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

/** 목업 모드 전용. 실제 서버에 가짜 거래가 들어가지 않도록 http 모드에서는 그리지 않는다 */
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
    <section className="mt-7">
      <h2 className="text-body font-bold text-ink">샘플 파일로 해 보기</h2>
      <p className="mt-1 text-small text-muted">
        목업 모드에서만 보입니다. 가짜 거래로 만든 파일입니다.
      </p>
      <ul className="mt-3 space-y-2">
        {samples.map((sample) =>
        <li key={sample.id}>
            <button
            type="button"
            onClick={() => onPick(sample.file)}
            className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors duration-150 ease-snap hover:border-accent-line hover:bg-accent-soft">

              <FileSpreadsheetIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-normal text-ink">
                  {sample.label}
                </span>
                <span className="block truncate text-caption text-muted">{sample.file.name}</span>
              </span>
              <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            </button>
          </li>
        )}
      </ul>
    </section>);

}

function ParsingCard({ file }: {file: File;}) {
  return (
    <section className="animate-rise rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center gap-2.5">
        <Loader2Icon className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
        <h2 className="text-body-lg font-bold text-ink">파일을 읽고 있습니다</h2>
      </div>
      <p className="mt-1.5 break-all text-small text-muted">
        {file.name} · 아직 서버로 보낸 것은 없습니다.
      </p>
    </section>);

}

function BlockedCard({
  file,
  outcome,
  onReset



}: {file: File;outcome: BlockedOutcome;onReset: () => void;}) {
  const billing = outcome.statement === '청구내역';
  return (
    <section className="animate-rise rounded-2xl border border-warn-line bg-warn-bg p-6">
      <div className="flex items-start gap-3">
        <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden="true" />
        <div className="min-w-0">
          <p className="break-all text-caption text-muted">{file.name}</p>
          <h2 className="mt-0.5 text-h4 font-bold text-warn">
            {billing ? '청구내역이라 판정할 수 없습니다' : '읽을 수 없는 파일입니다'}
          </h2>
          <p className="mt-2 max-w-xl text-small text-ink2">
            {billing ?
            '청구내역은 할부가 회차별로 쪼개져 있어, 350만원 자산 1건이 29만원 12건으로 보입니다. 이대로 판정하면 자산 판정을 빠져나가 실제 불가를 가능으로 내보낼 수 있어 업로드를 막았습니다.' :
            'KB국민카드 · IBK기업은행 승인내역 .xls 파일만 읽을 수 있습니다. 카드사에서 내려받은 파일을 고치지 말고 그대로 올려 주세요.'}
          </p>
          <p className="mt-2 text-small text-ink2">판별 근거: {BLOCKED_REASON[outcome.code]}</p>
          {billing &&
          <div className="mt-4 rounded-xl border border-warn-line bg-surface p-4">
              <h3 className="text-small font-bold text-ink">승인내역 받는 방법</h3>
              <p className="mt-1 text-small text-ink2">{APPROVAL_EXPORT_STEPS}</p>
            </div>
          }
          <Button className="mt-5" onClick={onReset}>
            다른 파일 올리기
          </Button>
        </div>
      </div>
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
  const sendCount = request?.transactions.length ?? 0;
  const error = send instanceof ApiRequestError ? send : null;
  const view = error ? sendErrorView(error) : null;
  // 같은 요청은 같은 오류로 끝나므로, 다시 보낼 수 있는 오류에서만 버튼을 살린다
  const canSend = request !== null && send !== 'sending' && (view === null || view.retry !== undefined);

  const counts = [
  { term: '읽은 행', value: rows.length },
  { term: '보낼 거래', value: sendCount },
  { term: '보내지 않는 행', value: unsendable.length },
  { term: '판정대상', value: stats.byStatus.판정대상 },
  { term: '취소상계', value: stats.byStatus.취소상계 },
  { term: '대상제외', value: stats.byStatus.대상제외 }];


  // 0건인 안내는 그리지 않는다
  const notes = ([
  [stats.cancelsPaired, (n: string) => `취소 ${n}건은 원래 결제와 짝지어 둘 다 취소상계로 표시했습니다.`],
  [
  stats.cancelsAmbiguous,
  (n: string) =>
  `취소 ${n}건은 같은 가맹점 · 같은 금액 결제가 여러 건이라 짝을 정하지 못했습니다. 후보 결제에 확인 필요를 붙였습니다.`],

  [stats.cancelsUnpaired, (n: string) => `취소 ${n}건은 원래 결제를 찾지 못했습니다. 조회 기간 밖에 있을 수 있습니다.`],
  [stats.nonTransaction, (n: string) => `할인 · 포인트 사용 ${n}건은 카드사 정산 행이라 대상제외로 표시했습니다.`],
  [stats.foreignOnlySkipped, (n: string) => `원화 금액이 없는 해외 결제 ${n}건은 읽지 않았습니다.`],
  [stats.aggregated, (n: string) => `교통비처럼 여러 결제를 묶은 합산 행 ${n}건을 표시했습니다.`],
  [
  stats.medicalMasked,
  (n: string) => `의료 업종 ${n}건은 가맹점명을 가리고, 사업자번호 · 메모는 보내지 않습니다.`]] as
  const).
  filter(([n]) => n > 0).
  map(([n, text]) => text(formatNumber(n)));

  const unsentColumns: Column<UnsendableRow>[] = [
  { header: '승인일', cell: (u) => <span className="whitespace-nowrap tabular-nums">{u.row.approvedAt || '—'}</span> },
  { header: '가맹점명', cell: (u) => u.row.rawMerchant || '—' },
  {
    header: '금액',
    align: 'right',
    cell: (u) => <span className="whitespace-nowrap">{u.row.amount === null ? '—' : formatWon(u.row.amount)}</span>
  },
  { header: '이유', cell: (u) => <span className="whitespace-nowrap">{UNSENT_REASON[u.code]}</span> }];


  const head = rows.slice(0, 10);
  const rowColumns: Column<ParsedRow>[] = [
  { header: '승인일', cell: (r) => <span className="whitespace-nowrap tabular-nums">{r.approvedAt || '—'}</span> },
  { header: '가맹점명', cell: (r) => r.rawMerchant || '—' },
  {
    header: '금액',
    align: 'right',
    cell: (r) => <span className="whitespace-nowrap">{r.amount === null ? '—' : formatWon(r.amount)}</span>
  },
  { header: '상태', cell: (r) => <Badge>{r.status}</Badge> }];


  return (
    <section className="animate-rise rounded-2xl border border-line bg-surface p-6">
      <p className="break-all text-caption text-muted">{file.name}</p>
      <h2 className="mt-0.5 text-h4 font-bold text-ink">
        {ISSUER[outcome.issuer]} 승인내역
        {request && ` · ${formatPeriod(request.periodStart, request.periodEnd)}`}
      </h2>

      <dl
        aria-label="파일에서 읽은 결과"
        className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">

        {counts.map((item) =>
        <div key={item.term} className="bg-surface px-4 py-3">
            <dt className="text-caption text-muted">{item.term}</dt>
            <dd className="mt-0.5 text-h4 font-bold tabular-nums text-ink">
              <data value={item.value}>{formatNumber(item.value)}</data>
            </dd>
          </div>
        )}
      </dl>

      {notes.length > 0 &&
      <ul className="mt-4 space-y-1.5 text-small text-ink2">
          {notes.map((note) =>
        <li key={note}>· {note}</li>
        )}
        </ul>
      }

      {unsendable.length > 0 &&
      <div className="mt-6">
          <h3 className="text-body font-bold text-ink">
            보내지 않는 행 {formatNumber(unsendable.length)}건
          </h3>
          <p className="mt-1 text-small text-muted">
            승인일 · 금액 · 가맹점명 중 하나가 없으면 서버가 받지 않습니다. 이 행은 판정에서 빠집니다.
          </p>
          <Table
          className="mt-3"
          caption="보내지 않는 행"
          columns={unsentColumns}
          rows={unsendable}
          rowKey={(u) => String(u.index)} />

        </div>
      }

      {head.length > 0 &&
      <div className="mt-6">
          <h3 className="text-body font-bold text-ink">
            처음 {formatNumber(head.length)}행
          </h3>
          <Table
          className="mt-3"
          caption={`읽은 행 중 처음 ${head.length}행`}
          columns={rowColumns}
          rows={head}
          rowKey={(r) => String(rows.indexOf(r))} />

        </div>
      }

      {request === null &&
      <p className="mt-6 rounded-xl border border-warn-line bg-warn-bg px-4 py-3 text-body font-bold text-warn">
          보낼 거래가 없습니다
        </p>
      }

      {error && view &&
      <div
        role="alert"
        className="mt-6 rounded-xl border border-deny-line bg-deny-bg px-4 py-3 text-small text-deny">

          <p>{view.message}</p>
          {error.traceId && <p className="mt-1 tabular-nums">추적 번호 {error.traceId}</p>}
          {view.history &&
        <Button className="mt-3" variant="secondary" size="sm" to="/uploads">
              업로드 이력 보기
            </Button>
        }
        </div>
      }

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <Button variant="secondary" onClick={onReset}>
          다른 파일 올리기
        </Button>
        <Button disabled={!canSend} onClick={onSend}>
          {send === 'sending' ? '올리는 중…' : view?.retry ?? `${formatNumber(sendCount)}건 올리기`}
        </Button>
      </div>
    </section>);

}

function ReadyCard({
  outcome,
  created,
  onReset



}: {outcome: ParsedOutcome;created: UploadBatchCreated;onReset: () => void;}) {
  const { request } = outcome;

  if (created.transactionCount === 0) {
    return (
      <section className="animate-rise rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-h4 font-bold text-ink">새로 들어간 거래가 없습니다</h2>
        <p className="mt-2 text-small text-ink2">
          이 파일의 거래 {formatNumber(created.skippedDuplicateCount)}건이 모두 이미 들어간 거래와
          겹쳐 넣지 않았습니다. 거래 없는 업로드 기록은 업로드 이력에서 지울 수 있습니다.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button to="/uploads">업로드 이력 보기</Button>
          <Button variant="secondary" onClick={onReset}>
            다른 파일 올리기
          </Button>
        </div>
      </section>);

  }

  const pending = created.classificationPendingCount;
  return (
    <section className="animate-rise rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-h4 font-bold text-ink">
        {formatNumber(created.transactionCount)}건을 올렸습니다
      </h2>
      {request &&
      <p className="mt-1 text-small text-muted">
          {ISSUER[outcome.issuer]} 승인내역 · {formatPeriod(request.periodStart, request.periodEnd)}
        </p>
      }
      {(created.skippedDuplicateCount > 0 || pending > 0) &&
      <ul className="mt-4 space-y-1.5 text-small text-ink2">
          {created.skippedDuplicateCount > 0 &&
        <li>
              · 이미 들어간 거래와 겹치는 {formatNumber(created.skippedDuplicateCount)}건은 넣지
              않았습니다.
            </li>
        }
          {pending > 0 && <li>· 가맹점 업종을 확인할 거래가 {formatNumber(pending)}건 있습니다.</li>}
        </ul>
      }
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {/* 미분류 거래는 판정되지 않으므로 분류 확인이 먼저다 */}
        <Button to={pending > 0 ? '/preview' : '/interview'}>
          {pending > 0 ? '다음: 분류 확인' : '다음: 사업자 문진'}
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button variant="secondary" onClick={onReset}>
          다른 파일 올리기
        </Button>
      </div>
    </section>);

}

/** 무엇이 서버로 가고 무엇이 남는지. 업로드 요청에 실제로 담기는 필드와 같아야 한다 */
function DataBoundary() {
  return (
    <aside className="h-fit rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-body font-bold text-ink">데이터 경계</h2>
      <div className="mt-4 space-y-4 text-small">
        <div>
          <p className="font-bold text-ink">서버로 보내는 것</p>
          <p className="mt-0.5 text-muted">
            승인일, 가맹점명(의료 업종은 가림), 금액, 할부 개월, 승인번호, 가맹점
            사업자번호(IBK기업), 메모(KB국민), 파일 해시
          </p>
          <p className="mt-1.5 text-caption text-muted">
            파일에서 계산한 값(카드사, 조회 기간, 처리 상태와 사유, 중복 판별 키)도 함께 보냅니다.
          </p>
        </div>
        <div className="h-px bg-line2" />
        <div>
          <p className="font-bold text-ink">브라우저에 남는 것</p>
          <p className="mt-0.5 text-muted">원본 파일, 카드번호, 이용고객명·이용카드명, 승인 시각</p>
        </div>
        <div className="h-px bg-line2" />
        <div>
          <p className="font-bold text-ink">로그에 남지 않는 것</p>
          <p className="mt-0.5 text-muted">소득 금액, 이름</p>
        </div>
        <div className="h-px bg-line2" />
        <div>
          {/* QR-7. 비서 도구가 모델에 넘기는 필드에서 뽑았다. 목록은 AI 쪽이 확정한다(agent-secretary.md 10장) */}
          <p className="font-bold text-ink">비서 Really 에게 물을 때 외부 모델로 보내는 것</p>
          <p className="mt-0.5 text-muted">{ASSISTANT_SENDS}</p>
          <p className="mt-1.5 text-caption text-muted">{ASSISTANT_DOES_NOT_SEND} 묻지 않으면 보내지 않습니다.</p>
        </div>
      </div>
    </aside>);

}
