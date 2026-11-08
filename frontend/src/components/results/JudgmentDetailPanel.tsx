import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import type { Judgment, JudgmentOriginType, LimitYear, Verdict } from '../../types/domain';
import { api, ApiRequestError, useApi } from '../../api';
import { Badge, Button, ChoiceGroup, Input, SymbolIcon, cn } from '../ui';
import { VerdictBadge } from '../VerdictBadge';
import { StatuteCitation } from '../StatuteCitation';
import { VERDICT_LABEL, VERDICT_META } from '../../utils/verdict';
import { formatFullDate, formatWon, ro } from '../../utils/format';
import {
  attributeRows,
  categoryLabel,
  bookingNote,
  formatStamp,
  merchantTitle,
  plainLaw,
  unavailableReason,
  verdictNote } from
'./display';

/** 2.8 판정이 바뀐 까닭. 이력에서 무엇이 바뀌었는지로 읽힌다 */
const ORIGIN_LABEL: Record<JudgmentOriginType, string> = {
  RUN: '자동 판정',
  USER_FACT: '답변 반영',
  CLASSIFICATION_REVIEW: '분류 확인 반영',
  OVERRIDE: '직접 수정'
};

/**
 * 확인 필요는 네 갈래다 (docs/rule-card-fields.md). verdict 는 모두 NEEDS_REVIEW 지만
 * 같은 문구로 보이면 ②(넘김)와 ③(남은 조건)이 정반대로 읽혀 사용자가 포기한다.
 * 불가인데 답할 질문이 남았으면 소명 대기다(주말·공휴일 식대 등). 추정일 뿐 확정이 아니다.
 */
type ReviewState = 'QUESTION' | 'HANDOFF' | 'FOLLOW_UP' | 'NO_RULE' | 'PRESUMED';

const REVIEW_MESSAGE: Record<ReviewState, string> = {
  QUESTION: '답할 질문이 남아 있습니다. 답하면 바로 다시 판정합니다.',
  HANDOFF: '판정하지 않고 세무사에게 넘겼습니다. 규칙으로 다루지 않는 지출입니다.',
  // rule-card-fields.md ③. 기간배분처럼 뒤에서 금액을 정할 답과, 혼용처럼 세무사 판단에 맡기는 답(#65)이
  // 함께 들어온다. 둘 다에 맞는 말로 쓴다
  FOLLOW_UP:
  '답을 반영했지만 아직 정하지 못했습니다. 업무에 쓴 비율이나 기간을 더 정해야 하거나, 세무사의 판단이 필요한 답입니다.',
  NO_RULE: '이 지출을 판정할 규칙이 아직 없습니다. 근거 없이 정하지 않고 확인 필요로 두었습니다.',
  PRESUMED: '답을 받기 전이라 일단 경비에서 뺐습니다. 업무에 쓴 것이라면 질문에 답해 주세요.'
};

/** 패널에서 가장 먼저 읽어야 하는 것이 판정이라 판정 글자만 판정 색으로 쓴다 */
const VERDICT_TEXT: Record<Verdict, string> = {
  AVAILABLE: 'text-ok',
  NEEDS_REVIEW: 'text-warn',
  UNAVAILABLE: 'text-deny'
};

/** 사용자가 바꿀 수 있는 판정. 확인 필요로 되돌리는 수정은 받지 않는다 (#62 논의) */
type Target = 'AVAILABLE' | 'UNAVAILABLE';

/** 3.8 reason. 자주 쓰는 사유를 고르고, 필요하면 덧붙여 적는다 */
const REASONS: Record<Target, string[]> = {
  AVAILABLE: ['사업에 직접 사용한 비용입니다', '업무 관련 지출이며 증빙이 있습니다'],
  UNAVAILABLE: ['개인적으로 사용한 비용입니다', '사업과 관련 없는 지출입니다']
};

const toLabel = (code: Target) => `${VERDICT_LABEL[code]}${ro(VERDICT_LABEL[code])}`;

const errorMessage = (caught: unknown, fallback: string) =>
caught instanceof ApiRequestError ? caught.message : fallback;

interface JudgmentDetailPanelProps {
  /** 거래의 현재 판정. 거래 요약(judgment.transaction)도 여기서 읽는다 */
  judgment: Judgment;
  /** 한도를 넘은 해의 접대비면 그해 한도(#226). 거래별 인정액 대신 한도 대상임을 보인다 */
  exceededLimit?: LimitYear;
  /** 사용자가 행을 고를 때마다 늘어난다. 바뀌면 제목으로 초점을 옮긴다(같은 행을 다시 골라도) */
  focusKey?: number;
  /** 수정·해제로 현재 판정이 바뀌었을 때 */
  onChanged: () => void;
  /** 이 거래를 판정 대상에서 뺐을 때. 가맹점 이름을 넘긴다 */
  onExcluded?: (merchant: string) => void;
  /** 바깥 상자에 더할 클래스. 넓은 화면은 높이를 막고 상자 안에서 스크롤한다 */
  className?: string;
}

export function JudgmentDetailPanel({
  judgment,
  exceededLimit,
  focusKey = 0,
  onChanged,
  onExcluded,
  className
}: JudgmentDetailPanelProps) {
  const transaction = judgment.transaction;
  const [target, setTarget] = useState<Target | null>(null);
  const [preset, setPreset] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 빼기 실패는 빼기 버튼 옆에 알린다. 판정 바꾸기의 실패와 자리가 다르다 */
  const [excludeError, setExcludeError] = useState<string | null>(null);
  const [done, setDone] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  const editHeading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLDivElement>(null);
  /**
   * 1.6 Idempotency-Key (#62). 응답을 못 받은 재시도에만 같은 키를 쓴다.
   * 판정·바꿀 값·사유 중 하나라도 바뀌면 새 키다 — 같은 키에 다른 내용이면 409 IDEMPOTENCY_KEY_REUSED 다
   */
  const pendingKey = useRef<{ payload: string; key: string } | null>(null);

  // 현재 판정이 바뀌면 이력도 다시 읽는다
  const historyQ = useApi(
    () =>
    api.judgments.list({
      transactionId: judgment.transactionId,
      latestOnly: false,
      size: 20
    }),
    [judgment.transactionId, judgment.id]
  );
  // 확인 필요·불가라면 이 거래에 남은 질문(①, 소명 대기)과 이미 답한 질문(③)이 있는지 본다.
  // ③을 origin 으로 판단하면 다시 판정(Run)한 뒤 origin 이 RUN 으로 바뀌어 안내가 사라진다
  const reviewQ = useApi(
    () =>
    judgment.verdict.code !== 'AVAILABLE' ?
    Promise.all([
    api.questions.list({ transactionId: judgment.transactionId, status: 'PENDING', size: 1 }),
    api.questions.list({ transactionId: judgment.transactionId, status: 'ANSWERED', size: 1 })]
    ).then(([pending, answered]) => ({
      pending: pending.page.totalElements,
      answered: answered.page.totalElements
    })) :
    Promise.resolve(null),
    [judgment.transactionId, judgment.id]
  );

  // 고른 행에 초점이 남아 있을 때만 패널로 옮긴다. 그사이 다른 곳으로 옮겼으면 뺏지 않는다
  useEffect(() => {
    if (focusKey === 0) return;
    const active = document.activeElement;
    if (!active || active === document.body || active.getAttribute('aria-current') === 'true')
    title.current?.focus();
  }, [focusKey]);

  // 폼을 열면 첫 사유로 초점을 옮긴다
  useEffect(() => {
    if (target) form.current?.querySelector<HTMLElement>('button')?.focus();
  }, [target]);

  const overridden = judgment.origin.type === 'OVERRIDE';
  const asset = judgment.attributes['자산'] === true;
  // 질문 조회가 끝나지 않았거나 실패했으면 ①·③을 가를 수 없다. 틀린 안내보다 안내 없음이 낫다
  // 지금 판정의 표지(범위 밖·규칙 없음)가 질문 상태보다 먼저다. 예전 답이 남아 있어도 규칙이 없으면 ④다
  const reviewState: ReviewState | null =
  judgment.verdict.code === 'AVAILABLE' || overridden ?
  null :
  judgment.verdict.code === 'UNAVAILABLE' ?
  reviewQ.data && !reviewQ.loading && !reviewQ.error && reviewQ.data.pending > 0 ? 'PRESUMED' : null :
  judgment.outOfScope ?
  'HANDOFF' :
  judgment.unmatchedReason === 'RULE_NOT_FOUND' || judgment.isInference ?
  'NO_RULE' :
  !reviewQ.data || reviewQ.loading || reviewQ.error ?
  null :
  reviewQ.data.pending > 0 ?
  'QUESTION' :
  reviewQ.data.answered > 0 ?
  'FOLLOW_UP' :
  null;
  // 수정했다면 규칙 엔진이 낸 마지막 판정을 함께 보여준다 (이력은 최신순)
  const engine = overridden ?
  historyQ.data?.items.find((revision) => revision.origin.type !== 'OVERRIDE') :
  undefined;
  // 서버 설명이 없으면(#132) 불가에는 막힌 단계로 문장을 만든다 (C10). 답변 대기 안내가 있으면 덧붙이지 않고,
  // 질문을 아직 읽는 중이면 기다린다. 먼저 띄우면 답변 대기로 바뀌면서 문장이 갈린다
  const because = overridden ?
  null :
  (judgment.explanation && plainLaw(judgment.explanation)) ?? (reviewState || reviewQ.loading ? null : unavailableReason(judgment));
  // 문장으로 말할 것이 없으면 「판정 이유」 칸을 통째로 뺀다. 근거는 맨 아래 조문 칸에 있다
  const hasReason = Boolean(reviewState || overridden || because);
  const note = verdictNote(judgment, reviewState === 'PRESUMED');
  const details = [
  ...(judgment.accountLabel ? [{ label: '계정과목', value: judgment.accountLabel }] : []),
  ...attributeRows(judgment.attributes)];

  const booking = bookingNote(judgment.attributes);
  const revisions = historyQ.data?.items ?? [];
  const targets: Target[] = (['AVAILABLE', 'UNAVAILABLE'] as const).filter(
    (code) => code !== judgment.verdict.code
  );
  const reason = [preset, memo.trim()].filter(Boolean).join(', ');

  const open = (next: Target) => {
    setTarget(next);
    setPreset('');
    setMemo('');
    setError(null);
    setDone('');
  };

  const close = () => {
    setTarget(null);
    editHeading.current?.focus();
  };

  const save = async () => {
    if (!target || !reason || busy) return;
    setBusy(true);
    setError(null);
    const payload = JSON.stringify([judgment.id, target, reason]);
    if (pendingKey.current?.payload !== payload)
    pendingKey.current = { payload, key: crypto.randomUUID() };
    try {
      await api.judgments.override(judgment.id, { toVerdict: target, reason }, pendingKey.current.key);
      pendingKey.current = null;
      setDone(`${toLabel(target)} 바꿨습니다.`);
      close();
      onChanged();
    } catch (caught) {
      // 409 는 그사이 현재 판정이 바뀌었거나 판정 대상에서 빠진 거래다 (#62). 다시 보내도 같으니
      // 폼을 닫고 지금 판정을 다시 읽는다
      if (caught instanceof ApiRequestError && caught.status === 409) {
        pendingKey.current = null;
        setError('판정이 그사이 바뀌었거나 판정 대상이 아니어서 바꾸지 못했습니다. 지금 판정을 다시 불러왔습니다.');
        close();
        onChanged();
        return;
      }
      setError(errorMessage(caught, '판정을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    if (!judgment.origin.id || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.judgments.removeOverride(judgment.origin.id);
      // 되돌리면 직접 바꾸기 전의 현재 판정으로 돌아간다. 그 판정은 답변 반영이나 분류 확인 반영일 수도 있다
      setDone('직접 바꾼 판정을 되돌렸습니다.');
      editHeading.current?.focus();
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught, '수정을 되돌리지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  /** 회의의 「결제 내역 삭제」. 거래를 지우지 않고 판정 대상에서 뺀다(3.4). 거래 화면에서 다시 넣을 수 있다 */
  const exclude = async () => {
    if (busy || !onExcluded) return;
    setBusy(true);
    setExcludeError(null);
    try {
      await api.transactions.exclude(judgment.transactionId);
      onExcluded(merchantTitle(transaction));
    } catch (caught) {
      setExcludeError(errorMessage(caught, '판정 대상에서 빼지 못했습니다. 잠시 후 다시 시도해 주세요.'));
      setBusy(false);
    }
  };

  return (
    <div className={cn('divide-y divide-line rounded-2xl border border-line bg-sheet', className)}>
      <header className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <p
            className={`flex items-center gap-2 text-h4 font-bold ${
            VERDICT_TEXT[judgment.verdict.code]}`
            }>

            <SymbolIcon symbol={VERDICT_META[judgment.verdict.code].symbol} className="h-4 w-4" />
            {judgment.verdict.label}
          </p>
          {note && <span className="shrink-0 whitespace-nowrap text-small text-ink2">{note}</span>}
        </div>
        {/* 띄어 쓰지 않은 긴 이름은 끊을 자리가 없어 상자 밖으로 나간다. 그때만 아무 데서나 끊는다 (C43).
            초점을 받아 화면 안으로 올 때 위의 판정 줄이 머리띠 밑에 숨지 않게 여백을 둔다 */}
        <h2
          ref={title}
          tabIndex={-1}
          className="mt-3 scroll-mt-36 text-h3 font-bold tracking-ir-sm text-ink outline-none [overflow-wrap:anywhere] [word-break:keep-all]">

          {merchantTitle(transaction)}
        </h2>
        <p className="mt-1 flex flex-wrap gap-x-3 text-small tabular-nums text-ink2">
          <span>{formatFullDate(transaction.approvedAt)}</span>
          <span>{categoryLabel(transaction.merchantCategory)}</span>
          {transaction.installmentMonths > 0 && <span>{transaction.installmentMonths}개월 할부</span>}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-px bg-line">
        <div className="bg-sheet px-5 py-4">
          <dt className="text-caption text-ink2">승인금액</dt>
          <dd className="mt-1 text-h3 font-bold tabular-nums tracking-ir-sm text-ink">
            {formatWon(transaction.amount)}
          </dd>
        </div>
        <div className="bg-sheet px-5 py-4">
          {/* 자산은 그해 넣을 수 있는 한도다. 「넣으세요」가 아니라 「까지 넣을 수 있습니다」 (CONTEXT.md G4) */}
          <dt className="text-caption text-ink2">
            {asset ? `${transaction.approvedAt.slice(0, 4)}년에 넣을 수 있는 금액` : '경비 가능 금액'}
          </dt>
          {exceededLimit ?
          <dd className="mt-1">
              <span className="block text-h4 font-bold text-ink">연간 한도 대상</span>
              <span className="mt-1 block text-caption text-ink2">
                {exceededLimit.taxYear}년 {exceededLimit.bucketLabel}가 한도 {formatWon(exceededLimit.limitAmount)}을 {formatWon(exceededLimit.excessAmount)} 넘어 거래마다 금액을
                정하지 않습니다.
              </span>
            </dd> :

          <dd
            className={`mt-1 text-h3 font-bold tabular-nums tracking-ir-sm ${
            judgment.finalAmount ? 'text-ink' : 'text-muted'}`
            }>

              {/* 서버는 가능이 아니면 0 을 준다(#184). 「0원」은 확인 필요를 금액이 정해진 것처럼 보이게 해 비워 둔다 */}
              {judgment.verdict.code === 'AVAILABLE' && judgment.finalAmount !== null ?
            `${formatWon(judgment.finalAmount)}${asset ? '까지' : ''}` :
            '-'}
            </dd>
          }
        </div>
      </dl>

      {hasReason &&
      <section className="px-5 py-4">
        <h3 className="text-body font-bold text-ink">판정 이유</h3>
        {reviewState &&
        <p className="mt-2 text-small leading-6 text-ink2">
            {REVIEW_MESSAGE[reviewState]}
            {(reviewState === 'QUESTION' || reviewState === 'PRESUMED') &&
          <Link
            to="/questions"
            className="mt-1 flex w-fit items-center gap-1 py-1 font-bold text-accent hover:underline">

                질문에 답하기
                <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
          }
          </p>
        }
        {/* 설명이 없으면 문장을 뺀다. 실서버는 아직 늘 null 이라(#132), 「설명이 없다」를 띄우면
            모든 판정에 같은 문장이 붙는다 */}
        {(overridden || because) &&
        <p className="mt-2 text-small leading-6 text-ink2">
          {overridden ?
          engine ? '직접 바꾼 판정입니다. 자동 판정은 아래와 같습니다.' : '직접 바꾼 판정입니다.' :
          because}
        </p>
        }
        {engine &&
        <div className="mt-2 text-small text-ink2">
            <p className="flex items-center gap-2">
              자동 판정 <VerdictBadge verdict={engine.verdict} />
            </p>
            {engine.explanation &&
          <p className="mt-1.5 leading-6">{plainLaw(engine.explanation)}</p>
          }
          </div>
        }
      </section>
      }

      {/* 계정과목·증빙은 짧고 먼저 읽을 것이라 바꾸기 위에 둔다 (C72) */}
      {(details.length > 0 || booking) &&
      <section className="px-5 py-4">
          {details.length > 0 &&
        <dl className="space-y-2 text-small">
              {details.map(({ label, value }) =>
          <div key={label} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-ink2">{label}</dt>
                  <dd className="text-right text-ink">{value}</dd>
                </div>
          )}
            </dl>
        }
          {booking &&
        <p className={cn('text-small leading-6 text-ink2', details.length > 0 && 'mt-3')}>{booking}</p>
        }
        </section>
      }

      <section className="px-5 py-4">
        <h3 ref={editHeading} tabIndex={-1} className="text-body font-bold text-ink outline-none">
          판정이 실제와 다르다면
        </h3>

        {/* 버튼은 판 폭을 채운다. 아래 빼기 버튼과 같은 폭이 된다 */}
        {target === null ?
        <div className="mt-3 flex gap-2">
            {targets.map((code) =>
          <Button
            key={code}
            variant="secondary"
            size="sm"
            className="flex-1 whitespace-nowrap"
            disabled={busy}
            onClick={() => open(code)}>

                {toLabel(code)} 바꾸기
              </Button>
          )}
            {overridden &&
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 whitespace-nowrap"
            disabled={busy}
            onClick={() => void release()}>

                수정 되돌리기
              </Button>
          }
          </div> :

        <div ref={form} className="mt-3 space-y-3">
            <p className="text-small font-bold text-ink">
              {toLabel(target)} 바꾸는 이유
            </p>
            <ChoiceGroup
            name={`${toLabel(target)} 바꾸는 이유`}
            columns={2}
            value={preset}
            onChange={setPreset}
            options={REASONS[target].map((text) => ({ value: text, label: text }))} />

            <Input
            aria-label="사유 직접 적기"
            placeholder="직접 적기 (선택)"
            maxLength={200}
            value={memo}
            onChange={(event) => setMemo(event.target.value)} />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" disabled={busy} onClick={close}>
                취소
              </Button>
              <Button size="sm" disabled={!reason || busy} onClick={() => void save()}>
                {busy ? '저장 중' : '저장'}
              </Button>
            </div>
          </div>
        }

        <p role="status" className="mt-2.5 text-small text-ink2 empty:mt-0">
          {done}
        </p>
        {error &&
        <p role="alert" className="mt-2 text-small text-deny">
            {error}
          </p>
        }
      </section>

      {onExcluded &&
      <section className="px-5 py-4">
          <h3 className="text-body font-bold text-ink">판정할 필요가 없는 거래라면</h3>
          {/* 불가에는 위에 「불가로 바꾸기」가 없어 빼면 어떻게 되는지만 적는다 (C105) */}
          {judgment.verdict.code === 'UNAVAILABLE' &&
          <p className="mt-1.5 text-small text-ink2">
              빼면 결과와 합계에서 사라지고, 거래 화면에서 다시 넣을 수 있습니다.
            </p>
          }
          <div className="mt-3 flex">
            <Button
            variant="secondary"
            size="sm"
            className="flex-1 whitespace-nowrap"
            disabled={busy}
            onClick={() => void exclude()}>

              판정 대상에서 빼기
            </Button>
          </div>
          {excludeError &&
        <p role="alert" className="mt-2 text-small text-deny">
              {excludeError}
            </p>
        }
        </section>
      }

      {/* 처음 판정 하나뿐이면 이력이 위 판정과 같아 뺀다. 바뀐 적이 있을 때 날짜와 까닭을 보여 준다 */}
      {(historyQ.error || revisions.length > 1) &&
      <section className="px-5 py-4">
          <h3 className="text-body font-bold text-ink">판정 이력</h3>
          {historyQ.error ?
        <p className="mt-2 text-small text-deny">
              이력을 불러오지 못했습니다.{' '}
              <button type="button" onClick={historyQ.reload} className="py-1 font-bold underline">
                다시 시도
              </button>
            </p> :

        <ol className="mt-2.5 space-y-2">
              {revisions.map((revision) =>
          <li key={revision.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small">
                  <span className="tabular-nums text-muted">{formatStamp(revision.computedAt)}</span>
                  <span className="text-ink2">{ORIGIN_LABEL[revision.origin.type]}</span>
                  <VerdictBadge verdict={revision.verdict} />
                  {revision.id === judgment.id && <Badge tone="ink">현재</Badge>}
                </li>
          )}
            </ol>
        }
        </section>
      }

      {/* 할 일(바꾸기, 빼기)을 먼저 두고 조문은 맨 끝에 둔다. 사람들은 조문보다 할 일을 먼저 찾는다 */}
      <section className="px-5 py-4">
        {/* 수정한 판정은 규칙 엔진의 근거를 그대로 들고 있다. 수정의 근거로 읽히지 않게 한다 */}
        <h3 className="text-body font-bold text-ink">
          {overridden ? '자동 판정의 근거 조문' : '근거 조문'}
        </h3>
        {judgment.citations.length > 0 ?
        <div className="mt-2.5 space-y-2">
            {judgment.citations.map((citation) =>
          <StatuteCitation
            key={citation.statuteVersionId}
            statuteVersionId={citation.statuteVersionId} />

          )}
          </div> :

        <p className="mt-2 text-small text-ink2">
            {judgment.verdict.code === 'NEEDS_REVIEW' && !overridden ?
          '붙일 근거 조문이 없어 가능이나 불가로 정하지 않았습니다.' :
          '붙은 근거 조문이 없습니다.'}
          </p>
        }
      </section>
    </div>);

}
