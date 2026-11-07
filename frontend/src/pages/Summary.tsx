import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CopyCheckIcon, CopyIcon, PrinterIcon, SearchXIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { StepEyebrow } from '../components/StepEyebrow';
import { Button, Empty, Table, type Column } from '../components/ui';
import { useSession } from '../contexts/SessionContext';
import { api, useApi } from '../api';
import { uploadName } from '../copy';
import type {
  BookkeepingDuty,
  Judgment,
  JudgmentSummary,
  StoredBusinessContext,
  UploadBatch,
  UnresolvedSummary } from
'../types/domain';
import { formatNumber, formatPeriod, formatWon } from '../utils/format';
import { excessNote, LIMITED_ACCOUNT, limitLine, limitsOf, PROVISIONAL_NOTE } from '../utils/limit';

type AccountRow = JudgmentSummary['byAccount'][number];

/* 접대비 한도는 연 단위로만 다룬다(#15, #226). batch 요약의 접대비는 한도 전 금액이고, 그해 초과액은 limits 로 따로 온다 */

/** 한 달 배치면 「2026년 1월」, 아니면 기간 그대로 */
const periodLabel = (batch: UploadBatch) => {
  const [startYear, startMonth] = batch.periodStart.split('-');
  const [endYear, endMonth] = batch.periodEnd.split('-');
  return startYear === endYear && startMonth === endMonth ?
  `${startYear}년 ${Number(startMonth)}월` :
  formatPeriod(batch.periodStart, batch.periodEnd);
};

/** 배치 기간이 걸친 해. 12월과 1월을 같이 올리면 두 해다 (C20) */
const yearsOf = (batch: UploadBatch) => {
  const from = Number(batch.periodStart.slice(0, 4));
  const to = Number(batch.periodEnd.slice(0, 4));
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
};

const amountOf = (judgments: Judgment[]) => judgments.reduce((sum, judgment) => sum + (judgment.finalAmount ?? 0), 0);

/** 「2025년 120,000원, 2026년 434,500원」 */
const yearAmounts = (byYear: [number, number][]) =>
byYear.map(([year, amount]) => `${year}년 ${formatWon(amount)}`).join(', ');

/** 문진 화면과 같은 이름 (C87) */
const DUTY: Record<BookkeepingDuty, string> = {
  복식부기: '복식부기 의무자',
  간편장부: '간편장부 대상자',
  추계: '추계 신고'
};

interface Handoff {
  batch: UploadBatch | null;
  summary: JudgmentSummary;
  /** 해마다 나눈 경비 가능 금액. 한 해에 든 배치거나 아직 못 읽었으면 null */
  byYear: [number, number][] | null;
  /** 사용자가 직접 바꾼 현재 판정. 못 읽었으면 null */
  overridden: Judgment[] | null;
  unclassified: number;
  unresolved: UnresolvedSummary | undefined;
  context: StoredBusinessContext | null | undefined;
}

/**
 * 세무사에게 넘길 문장. 화면에 보이는 숫자와 문진 응답만으로 만든다.
 * 판정하지 않은 것을 판정한 것처럼 말하지 않는다.
 */
const handoffText = ({ batch, summary, byYear, overridden, unclassified, unresolved, context }: Handoff) => {
  const { AVAILABLE, UNAVAILABLE, NEEDS_REVIEW } = summary.byVerdict;
  const lines = [
  `${batch ? `${periodLabel(batch)} ${uploadName(batch)}` : '카드내역'} 중 판정한 ${formatNumber(summary.totalCount)}건의 결과입니다.`,
  `가능 ${formatNumber(AVAILABLE.count)}건(경비 가능 금액 ${formatWon(AVAILABLE.finalAmount)}), 불가 ${formatNumber(UNAVAILABLE.count)}건, 확인 필요 ${formatNumber(NEEDS_REVIEW.count)}건입니다.`];
  // 사용자가 바꾼 판정은 규칙이 낸 것이 아니다. 세무사가 따로 볼 수 있게 몇 건을 어느 쪽으로 바꿨는지 적는다 (C27)
  if (overridden) {
    const toAvailable = overridden.filter((judgment) => judgment.verdict.code === 'AVAILABLE');
    const toUnavailable = overridden.filter((judgment) => judgment.verdict.code === 'UNAVAILABLE');
    const changed = [
    toAvailable.length > 0 && `가능으로 바꾼 것이 ${formatNumber(toAvailable.length)}건(${formatWon(amountOf(toAvailable))})`,
    toUnavailable.length > 0 && `불가로 바꾼 것이 ${formatNumber(toUnavailable.length)}건`].
    filter(Boolean);
    if (changed.length > 0) lines.push(`이 가운데 판정을 직접 ${changed.join(', ')}입니다.`);
  }
  if (byYear) lines.push(`경비 가능 금액을 해마다 나누면 ${yearAmounts(byYear)}입니다.`);
  const limited = summary.byAccount.find((row) => row.account === LIMITED_ACCOUNT);
  const limits = limitsOf(summary.limits);
  if (limited)
  lines.push(
    `경비 가능 금액 중 접대비는 ${formatWon(limited.finalAmount)}이고 연간 한도 대상입니다.${
    limits.length > 0 ?
    ` 올린 카드내역 전체 기준으로 ${limits.map(limitLine).join(', ')}입니다(${PROVISIONAL_NOTE}).` :
    ''}${
    limits.some((item) => item.excessAmount > 0) ?
    ' 초과액은 연 단위라 위 금액에서 빼지 않았습니다.' :
    ''}`
  );

  if (unclassified > 0)
  lines.push(`가맹점을 분류하지 못한 ${formatNumber(unclassified)}건은 아직 판정하지 않았습니다.`);
  if (unresolved && unresolved.count > 0)
  lines.push(
    `사용 목적 등 아직 답하지 않은 질문이 ${formatNumber(unresolved.count)}개이고, 관련 거래 금액은 ${formatWon(unresolved.amount)}입니다.`
  );
  // 판정에 쓴 문진이 이와 다를 수 있다. 지금 응답임을 밝힌다
  if (context)
  lines.push(
    `현재 문진 응답: 업종코드 ${context.industryCode}, ${DUTY[context.bookkeepingDuty]}, 직원 ${
    context.hasEmployee ? '있음' : '없음'}, 작업 공간 면적 비율 ${
    context.homeOfficeRatio === null ?
    '입력 안 함' :
    context.homeOfficeRatio ?
    `${context.homeOfficeRatio}%` :
    '해당 없음'}.`
  );
  return lines.join(' ');
};


/**
 * 3.7 판정 결과 요약.
 * batchId 로 거래별 현재 판정을 집계한다. 한도 잔량·감가상각 스케줄은 API 가 없어
 * 보여주지 않는다 — 응답에 없는 숫자를 화면에 두지 않는다.
 * 집계에 없는 것(직접 바꾼 판정, 해마다 나눈 금액)은 내보내기(#214)의 현재 판정에서 센다.
 */
export function Summary() {
  const { batchId, batchStatus, reloadBatch } = useSession();
  const [copy, setCopy] = useState<'idle' | 'done' | 'failed'>('idle');

  const batchQ = useApi(
    () => batchId ? api.uploads.get(batchId) : Promise.resolve(null),
    [batchId]
  );
  const summaryQ = useApi(
    () => batchId ? api.judgments.summary({ batchId }) : Promise.resolve(null),
    [batchId]
  );
  const exportQ = useApi(
    () => batchId ? api.judgments.export({ batchId }) : Promise.resolve(null),
    [batchId]
  );
  const questionsQ = useApi(
    () =>
    batchId ?
    api.questions.grouped({ batchId, status: 'PENDING', size: 1 }) :
    Promise.resolve(null),
    [batchId]
  );
  const answeredQ = useApi(
    () =>
    batchId ?
    api.questions.grouped({ batchId, status: 'ANSWERED', size: 1 }) :
    Promise.resolve(null),
    [batchId]
  );
  const contextQ = useApi(() => api.contexts.current(), []);
  // 비서로 넣어 둔 세무사 질문 (FR-16). 사용자 단위로 모은다
  const notesQ = useApi(() => api.handoffNotes.list(), []);
  // 아직 분류하지 못해 판정하지 않은 거래 수. 배치의 분류 대기 수는 분류 확인 뒤 바로 줄지 않을 수 있어 거래에서 센다
  const unclassifiedQ = useApi(
    () =>
    batchId ?
    // 판정 대상에서 뺀 거래는 세지 않는다(문장 설명과 같게)
    api.transactions.list({ batchId, status: 'JUDGEABLE', classificationStatus: 'NEEDS_REVIEW', size: 1 }) :
    Promise.resolve(null),
    [batchId]
  );

  // 「복사했습니다」는 잠깐만 보여준다. 실패 안내는 직접 복사할 때까지 남긴다
  useEffect(() => {
    if (copy !== 'done') return;
    const timer = window.setTimeout(() => setCopy('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [copy]);

  const summary = summaryQ.data;
  const batch = batchQ.data;
  const unresolved = questionsQ.data?.unresolved;
  const excess = summary ? excessNote(summary.limits) : null;

  const header =
  <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <StepEyebrow>요약</StepEyebrow>
        <h1 className="mt-1.5 text-h2 font-bold tracking-tight text-ink">요약</h1>
      </div>
      {/* PDF 는 서버에서 만들지 않는다. 인쇄용 스타일(index.css)로 화면 틀을 빼고 브라우저 인쇄로 저장한다 */}
      {summary && summary.totalCount > 0 &&
    <Button variant="secondary" size="sm" className="print:hidden" onClick={() => window.print()}>
          <PrinterIcon className="h-4 w-4" aria-hidden="true" />
          PDF로 저장
        </Button>
    }
    </header>;


  // 볼 업로드를 아직 고르는 중이다. 「올린 카드내역이 없습니다」를 먼저 그리지 않는다 (C56)
  if (!batchId && batchStatus === 'loading')
  return (
    <AppShell>
        {header}
        <span className="mt-8 block h-9 w-48 animate-pulse rounded bg-line2" />
      </AppShell>);


  const empty =
  !batchId ?
  batchStatus === 'error' ?
  {
    title: '올린 카드내역을 불러오지 못했습니다',
    tone: 'error' as const,
    action:
    <Button size="sm" variant="secondary" onClick={reloadBatch}>
            다시 시도
          </Button>

  } :
  {
    title: '올린 카드내역이 없습니다',
    action:
    <Button to="/upload" size="sm" variant="secondary">
            카드내역 올리기
          </Button>

  } :
  summaryQ.error ?
  {
    title: '요약을 불러오지 못했습니다',
    tone: 'error' as const,
    action:
    <Button size="sm" variant="secondary" onClick={summaryQ.reload}>
          다시 시도
        </Button>

  } :
  summary?.totalCount === 0 ?
  {
    title: '아직 판정한 거래가 없습니다',
    action:
    <Button to="/confirm" size="sm" variant="secondary">
          판정하러 가기
        </Button>

  } :
  null;

  if (empty)
  return (
    <AppShell>
        {header}
        <Empty className="mt-6" icon={<SearchXIcon className="h-5 w-5" />} {...empty} />
      </AppShell>);


  const counts = {
    available: summary?.byVerdict.AVAILABLE.count ?? 0,
    needsReview: summary?.byVerdict.NEEDS_REVIEW.count ?? 0,
    unavailable: summary?.byVerdict.UNAVAILABLE.count ?? 0
  };
  const total = summary?.totalCount ?? 0;

  const distribution = [
  { label: '가능', value: counts.available, bar: 'bg-ok-bar' },
  { label: '확인 필요', value: counts.needsReview, bar: 'bg-warn-bar' },
  { label: '불가', value: counts.unavailable, bar: 'bg-deny-bar' }];


  // 신고는 해마다 따로 한다. 두 해에 걸친 업로드는 합계를 해마다 나눠 보인다 (C20)
  const years = batch ? yearsOf(batch) : [];
  const judgments = exportQ.data?.items.map((row) => row.judgment) ?? null;
  const byYear: [number, number][] | null =
  years.length > 1 && judgments ?
  years.map((year) => [
  year,
  amountOf(
    judgments.filter(
      (judgment) => judgment.verdict.code === 'AVAILABLE' && judgment.transaction.approvedAt.startsWith(String(year))
    )
  )]
  ) :
  null;
  const spanLine =
  years.length > 1 ?
  byYear ?
  `해마다 나누면 ${yearAmounts(byYear)}입니다.` :
  `${years.map((year) => `${year}년`).join(', ')} 거래를 합친 금액입니다.` :
  null;

  // 계정과목이 없는 경비 가능 금액(예: 사용자가 가능으로 바꾼 거래)도 표에 남겨 합계가 맞게 한다
  const accountRows: AccountRow[] = summary ? [...summary.byAccount] : [];
  if (summary) {
    const listed = summary.byAccount.reduce(
      (sum, row) => ({ count: sum.count + row.count, amount: sum.amount + row.finalAmount }),
      { count: 0, amount: 0 }
    );
    const rest = summary.byVerdict.AVAILABLE.finalAmount - listed.amount;
    if (rest > 0)
    accountRows.push({
      account: '계정과목 미지정',
      count: Math.max(0, summary.byVerdict.AVAILABLE.count - listed.count),
      finalAmount: rest
    });
  }

  const accountColumns: Column<AccountRow>[] = [
  {
    header: '계정과목',
    cell: (row) => <span className="whitespace-nowrap text-ink">{row.account}</span>
  },
  {
    header: '건수',
    align: 'right',
    width: 'w-20',
    cell: (row) => <span className="whitespace-nowrap text-ink2">{formatNumber(row.count)}건</span>
  },
  {
    header: <span className="whitespace-nowrap">경비 가능 금액</span>,
    align: 'right',
    width: 'w-36',
    cell: (row) =>
    <span className="whitespace-nowrap font-bold text-ink">
          {formatWon(row.finalAmount)}
        </span>

  }];



  const answeredGroups = answeredQ.data?.page.totalElements ?? 0;
  // 문장에 들어갈 건수를 아직 다 읽지 못했으면 복사하지 않는다. 빠진 채로 넘기면 「남은 것 없음」으로 읽힌다
  const settling =
  batchQ.loading || exportQ.loading || questionsQ.loading || unclassifiedQ.loading || contextQ.loading || notesQ.loading;
  const omitted = [
  batchQ.error && '기간',
  exportQ.error && '직접 바꾼 판정',
  exportQ.error && years.length > 1 && '해마다 나눈 금액',
  questionsQ.error && '답하지 않은 질문',
  unclassifiedQ.error && '분류하지 못한 거래 수',
  contextQ.error && '문진 응답',
  notesQ.error && '따로 물을 질문'].
  filter(Boolean);
  const notes = notesQ.data ?? [];
  const notesText =
  notes.length > 0 ? ` 따로 여쭐 것: ${notes.map((note, index) => `${index + 1}) ${note.text}`).join(' ')}` : '';
  const unclassified = unclassifiedQ.data?.page.totalElements ?? 0;
  const overridden = judgments?.filter((judgment) => judgment.origin.type === 'OVERRIDE') ?? null;
  // 못 읽은 항목은 화면에만 알리지 않고, 붙여 넣은 문장에도 남긴다
  const text = summary ?
  `${handoffText({ batch, summary, byYear, overridden, unclassified, unresolved, context: contextQ.data })}${notesText}${
  omitted.length > 0 ? ` (불러오지 못해 빠진 항목: ${omitted.join(', ')})` : ''}` :
  '';


  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopy('done');
    } catch {
      setCopy('failed');
    }
  };

  return (
    <AppShell>
      {header}

      <section className="mt-8">
        <p className="text-small text-ink2">이 업로드의 경비 가능 금액</p>
        {summary ?
        <p className="mt-1.5 text-stat font-bold tabular-nums text-ink">
            {formatWon(summary.byVerdict.AVAILABLE.finalAmount)}
          </p> :

        <span className="mt-1.5 block h-9 w-48 animate-pulse rounded bg-line2" />
        }
        {batch &&
        <p className="mt-2 text-small tabular-nums text-ink2">
            {uploadName(batch)}, {periodLabel(batch)}
          </p>
        }
        {spanLine && <p className="mt-1 text-small tabular-nums text-ink2">{spanLine}</p>}
        {/* 초과액은 그해 사용자 전체 기준이라 이 업로드 몫을 정할 수 없다(#15). 합계에서 빼지 않고 따로 알린다 */}
        {excess && <p className="mt-4 max-w-2xl text-small text-ink2">{excess}</p>}

        {unresolved && unresolved.count > 0 &&
        <p className="mt-4 text-small text-ink2">
            답하지 않은 질문이 {formatNumber(unresolved.count)}개 있습니다. 답하면 위 금액이 바뀔 수 있습니다.
          </p>
        }
        {questionsQ.error &&
        <p className="mt-4 text-small text-deny">
            답하지 않은 질문 수를 불러오지 못했습니다. 새로고침해 주세요.
          </p>
        }
        {unclassified > 0 &&
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-small text-ink2">
            가맹점을 분류하지 못한 {formatNumber(unclassified)}건은 아직 판정하지 않았습니다.
            <Link
            to="/preview"
            className="inline-flex items-center gap-1 whitespace-nowrap font-bold text-accent hover:underline">

              분류 확인하기
              <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </p>
        }

        <div className="mt-6" aria-hidden="true">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-line2">
            {distribution.map((item) =>
            <div
              key={item.label}
              className={item.bar}
              style={{ width: `${total ? item.value / total * 100 : 0}%` }} />

            )}
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-4">
          {distribution.map((item) =>
          <div key={item.label}>
              <dt className="flex items-center gap-1.5 whitespace-nowrap text-caption text-ink2">
                <span className={`h-2 w-2 rounded-full ${item.bar}`} aria-hidden="true" />
                {item.label}
              </dt>
              <dd className="mt-1 text-h4 font-bold tabular-nums text-ink">
                {summary ?
              `${formatNumber(item.value)}건` :
              <span className="block h-6 w-12 animate-pulse rounded bg-line2" />}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="text-body font-bold text-ink">계정과목별 경비 가능 금액</h2>
        <Table
          className="mt-3"
          caption="계정과목별 경비 가능 금액"
          columns={accountColumns}
          rows={accountRows}
          rowKey={(row) => row.account}
          loading={summaryQ.loading}
          empty={<Empty title="가능으로 판정한 거래가 아직 없습니다" />} />

      </section>

      <section className="mt-10">
        <h2 className="text-body font-bold text-ink">세무사에게 넘길 문장</h2>
        <blockquote className="mt-3 rounded-xl border border-line p-4 text-small leading-6 text-ink">
          {text}
        </blockquote>
        {omitted.length > 0 &&
        <p className="mt-2 text-caption text-deny">
            불러오지 못해 문장에서 뺀 것: {omitted.join(', ')}. 새로고침한 뒤 다시 복사해 주세요.
          </p>
        }
        <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
          <Button variant="secondary" size="sm" disabled={!text || settling} onClick={() => void copyText()}>
            {copy === 'done' ?
            <CopyCheckIcon className="h-4 w-4" aria-hidden="true" /> :
            <CopyIcon className="h-4 w-4" aria-hidden="true" />}
            {copy === 'done' ? '복사했습니다' : '문장 복사'}
          </Button>
          {unresolved && unresolved.count > 0 ?
          <Button to="/questions" variant="secondary" size="sm">
              질문에 답하기
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Button> :
          answeredGroups > 0 &&
          <Button to="/questions" variant="secondary" size="sm">
              답한 질문 보기
            </Button>
          }
          <Button to="/results" variant="ghost" size="sm">
            결과 보기
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <span role="status" className="sr-only">
          {copy === 'done' ? '문장을 복사했습니다.' : ''}
        </span>
        {copy === 'failed' &&
        <p role="alert" className="mt-3 text-small text-deny">
            복사하지 못했습니다. 문장을 직접 선택해 복사해 주세요.
          </p>
        }
      </section>

      {/* 소득세법 §160의2①, 시행령 §208의2④⑤. 승인내역으로는 보관 여부를 알 수 없어 거래마다 묻지 않고 안내한다 */}
      <section className="mt-10">
        <h2 className="text-body font-bold text-ink">증빙 보관</h2>
        <p className="mt-2 max-w-3xl text-small leading-6 text-ink2">
          카드 결제 증빙은 카드사에서 받은 월별이용대금명세서를 확정신고기간 종료일부터 5년간 보관해 주세요. 올린
          승인내역 파일은 명세서로 인정되지 않을 수 있습니다. 국세청 현금영수증 홈페이지에 사업용 신용카드로 등록한 카드의
          매출전표는 보관하지 않아도 됩니다.
        </p>
      </section>
    </AppShell>);

}
