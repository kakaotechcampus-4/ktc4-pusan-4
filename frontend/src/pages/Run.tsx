import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { StepEyebrow } from '../components/StepEyebrow';
import { useAssistant } from '../components/assistant/context';
import { api, ApiRequestError, isMock } from '../api';
import { useSession } from '../contexts/SessionContext';
import { merchantTitle } from '../components/results/display';
import type {
  JudgmentRun,
  JudgmentRunFailure,
  JudgmentSummary,
  Transaction,
  Verdict } from
'../types/domain';
import { Badge, Button, cn } from '../components/ui';
import { formatNumber, formatWon } from '../utils/format';
import { AWAITING_ANSWER, VERDICT_LABEL, VERDICT_META, awaitingOf } from '../utils/verdict';
import { pollErrorOf, runPhase, type PollError } from './runPhase';

/**
 * 실패 사유는 errorCode 로 고른다(api.md 3.6). message 는 서버가 예외 문장을 그대로 담기도 해서(#127)
 * 화면에 내지 않는다. 모르는 코드는 일반 문구로 보인다
 */
const FAILURE_LABEL: Record<string, string> = {
  RULE_PROCESSING_FAILED: '처리 오류',
  RUN_START_FAILED: '시작 실패',
  RUN_INTERRUPTED: '중단됨'
};
const UNKNOWN_FAILURE = '실패';

/** 실패한 거래는 이만큼만 이름과 함께 보이고, 나머지는 「외 N건」으로 센다 */
const FAILURES_SHOWN = 5;

const VERDICTS: Verdict[] = ['AVAILABLE', 'NEEDS_REVIEW', 'UNAVAILABLE'];

/** 다시 물어도 같은 실패. 이때만 다른 업로드로 가는 길을 준다 */
const GONE_TEXT: Record<Exclude<PollError, 'transient'>, string> = {
  missing: isMock ?
  '체험 화면은 새로고침하면 처음 상태로 돌아갑니다.' :
  '업로드가 지워졌을 수 있습니다.',
  badAddress: '주소가 잘못됐습니다.'
};

/** runId 없이 들어오면 확인 화면으로 보낸다. 판정 실행은 확인 화면에서만 만든다 (#187) */
export function RunEntry() {
  return <Navigate to="/confirm" replace />;
}

/**
 * 판정 진행. runId 는 주소(`/run/:runId`)에서 읽는다 — 새로고침해도 같은 실행을 이어서 보고,
 * 새 실행을 만들지 않는다 (#187). 뒤로·앞으로 가기로 다른 실행에 오면 앞 실행의 상태가 남지 않게 새로 그린다
 */
export function Run() {
  const { runId } = useParams<{ runId: string }>();
  return <RunProgress key={runId} />;
}

function RunProgress() {
  const navigate = useNavigate();
  const { runId = null } = useParams<{ runId: string }>();
  const { showNudge } = useAssistant();
  const { batchId, setBatchId } = useSession();
  const [run, setRun] = useState<JudgmentRun | null>(null);
  const [pollError, setPollError] = useState<PollError | null>(null);
  /** null 은 아직 받지 않음 */
  const [byVerdict, setByVerdict] = useState<JudgmentSummary['byVerdict'] | null>(null);
  /** 불가 가운데 답을 기다리는 거래 수. 불가와 따로 센다 (C12) */
  const [awaitingCount, setAwaitingCount] = useState(0);
  const [countsFailed, setCountsFailed] = useState(false);
  /** 올리면 집계를 다시 읽는다 */
  const [countsAttempt, setCountsAttempt] = useState(0);
  /** null 은 아직 받지 않음. 빈 배열은 받았는데 비었거나 읽지 못함(run 시작 실패 등, #127) */
  const [failures, setFailures] = useState<JudgmentRunFailure[] | null>(null);
  const [failedTx, setFailedTx] = useState<Map<string, Transaction>>(new Map());
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const timer = useRef<number | null>(null);

  // 1초 폴링. SSE 토큰 방식이 정해지면 교체 (명세 4.3 #9)
  useEffect(() => {
    if (!runId) return;
    const id = runId;
    let stopped = false;
    let inFlight = false;

    const stop = () => {
      stopped = true;
      if (timer.current) window.clearInterval(timer.current);
    };

    const poll = () => {
      // 응답이 1초보다 오래 걸리면 요청이 겹치고, 늦게 온 옛 상태가 새 상태를 덮는다
      if (inFlight || stopped) return;
      inFlight = true;
      void api.runs.
      get(id).
      then(
        (next) => {
          inFlight = false;
          if (stopped) return;
          setPollError(null);
          setRun(next);
          if (runPhase(next) !== 'running') stop();
        },
        (caught: unknown) => {
          inFlight = false;
          if (stopped) return;
          // 없는 실행·잘못된 주소는 다시 물어도 같으니 멈춘다. 그 밖의 오류는 진행 화면을 둔 채 다음 주기에 다시 해본다
          const kind = pollErrorOf(caught);
          if (kind !== 'transient') stop();
          setPollError(kind);
        }
      );
    };

    poll();
    timer.current = window.setInterval(poll, 1000);
    return stop;
  }, [runId]);

  const phase = runPhase(run);
  const finished = phase !== 'loading' && phase !== 'running';
  /** 결과가 있는 실행. 집계와 결과 보기를 보인다 */
  const judged = phase === 'completed' || phase === 'partial';
  const failedCount = run?.failedCount ?? 0;
  const runBatchId = run?.batchId ?? null;

  // 집계를 못 읽어도 판정은 끝났다. 결과 보기는 그대로 두고 그 자리에서 다시 읽게 한다 (C62)
  useEffect(() => {
    if (!runId || !judged || !runBatchId) return;
    let cancelled = false;
    setCountsFailed(false);
    void Promise.all([
    api.judgments.summary({ runId }),
    api.judgments.list({ runId, verdict: 'UNAVAILABLE', size: 100 }),
    api.questions.list({ batchId: runBatchId, status: 'PENDING', size: 100 })]
    ).
    then(
      ([summary, unavailable, questions]) => {
        if (cancelled) return;
        setAwaitingCount(awaitingOf(unavailable.items, questions.items.map((question) => question.transactionId)).length);
        setByVerdict(summary.byVerdict);
      },
      () => {
        if (!cancelled) setCountsFailed(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [runId, judged, runBatchId, countsAttempt]);

  useEffect(() => {
    if (!runId || !finished || failedCount === 0) return;
    let cancelled = false;
    void api.runs.
    failures(runId, { size: FAILURES_SHOWN }).
    then(async (page) => {
      if (cancelled) return;
      setFailures(page.items);
      // 실패 목록은 transactionId 만 준다. 보여 줄 거래만 따로 읽어 이름을 붙인다.
      // 배치 거래를 앞에서부터 읽으면 뒤쪽 거래의 이름이 빠진다
      const found = await Promise.all(
        page.items.map((failure) => api.transactions.get(failure.transactionId).catch(() => null))
      );
      if (cancelled) return;
      setFailedTx(new Map(found.filter((t): t is Transaction => t !== null).map((t) => [t.id, t])));
    }).
    catch(() => {
      // 어떤 거래인지 모른다고만 하고, 다시 판정하는 길은 남긴다
      if (!cancelled) setFailures([]);
    });
    return () => {
      cancelled = true;
    };
  }, [runId, finished, failedCount]);

  /*
   * FR-3: 지난번 답으로 채울 수 있는 질문이 있으면 이 실행에 한 번 알린다. 못 읽으면 알리지 않는다.
   * 질문 화면은 고른 업로드의 질문을 연다. 다른 업로드를 보고 있을 때 알리면 엉뚱한 질문으로 가므로 알리지 않는다 (C53)
   */
  useEffect(() => {
    if (!runId || !judged || !runBatchId || runBatchId !== batchId) return;
    let cancelled = false;
    void api.progress.
    get(runBatchId).
    then(({ questions }) => {
      if (cancelled || questions.fillableFromPrevious === 0) return;
      showNudge(
        {
          text: `지난번 답으로 채울 수 있는 질문이 ${formatNumber(questions.fillableFromPrevious)}개 있습니다. 질문 화면에서 확인하고 적용합니다.`,
          route: '/questions',
          actionLabel: '질문 보기'
        },
        `run:${runId}`
      );
    }).
    catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [runId, judged, runBatchId, batchId, showNudge]);

  /**
   * 이 실행의 업로드는 결과 보기를 누를 때 고른다. 화면을 여는 것만으로 바꾸면 뒤로 가기로 예전 실행을
   * 열었을 때 보던 업로드가 말없이 바뀐다 (C53)
   */
  const openResults = () => {
    if (run) setBatchId(run.batchId);
    navigate('/results');
  };

  /** 재시도는 같은 배치·문진으로 새 Run 을 만드는 것이다 (api.md 3.6 재실행) */
  const retry = async () => {
    if (!run) return;
    setRetrying(true);
    setRetryFailed(false);
    try {
      const created = await api.runs.create({ batchId: run.batchId, contextId: run.contextId });
      setFailures(null);
      setRun(null);
      navigate(`/run/${created.id}`);
    } catch (caught) {
      /*
       * 이 배치에 이미 돌고 있는 판정이 있다 (#228). 끝난 run 뒤 재실행은 막지 않으니
       * 여기까지 오면 다른 탭이 눌렀다. 지금 보고 있는 실행과 같은 id 면 주소가 그대로여서
       * key 가 바뀌지 않고 — 비운 상태로 남는다. 그때는 아래 문구로 떨어뜨린다
       */
      if (
        caught instanceof ApiRequestError &&
        caught.code === 'RUN_ALREADY_ACTIVE' &&
        caught.runId &&
        caught.runId !== runId)
      {
        setFailures(null);
        setRun(null);
        navigate(`/run/${caught.runId}`);
        return;
      }
      setRetryFailed(true);
    } finally {
      setRetrying(false);
    }
  };

  const total = run?.totalCount ?? 0;
  const processed = run?.processedCount ?? 0;
  const progress = total ? Math.round(processed / total * 100) : 0;
  const goneText =
  pollError === 'missing' || pollError === 'badAddress' ? GONE_TEXT[pollError] : null;

  return (
    <AppShell>
      <div className="max-w-3xl">
        <header>
          <StepEyebrow />
          <h1 aria-live="polite" className="mt-1.5 text-h2 font-bold tracking-tight text-ink">
            {goneText ?
            '판정을 찾을 수 없습니다' :
            phase === 'failed' ?
            '판정하지 못했습니다' :
            phase === 'partial' ?
            '일부를 판정하지 못했습니다' :
            phase === 'empty' ?
            '판정할 거래가 없습니다' :
            phase === 'completed' ?
            '판정을 마쳤습니다' :
            '판정하고 있습니다'}
          </h1>
        </header>

        {goneText &&
        <div className="mt-6">
            <p role="alert" className="text-body text-ink2">{goneText}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button to="/upload" size="sm">카드내역 올리기</Button>
              <Button to="/uploads" variant="secondary" size="sm">업로드 이력</Button>
            </div>
          </div>
        }

        {!goneText && !finished &&
        <div className="mt-8">
            <p aria-live="polite" className="text-stat font-bold leading-none tabular-nums text-ink">
              {run ?
              <>
                  {formatNumber(processed)}
                  <span className="text-lead font-normal text-ink2"> / {formatNumber(total)}건</span>
                </> :
              <span className="invisible">0</span>}
            </p>
            <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-line2"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="판정 진행률">
              <div
              className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
              style={{ width: `${progress}%` }} />
            </div>
            {pollError === 'transient' &&
            <p role="status" className="mt-4 text-small text-ink2">
                연결이 불안정해 다시 확인하고 있습니다.
              </p>
            }
          </div>
        }

        {phase === 'empty' &&
        <div className="mt-6">
            <p className="text-body text-ink2">
              취소, 제외된 거래와 분류하지 않은 거래는 판정하지 않습니다.
            </p>
            <Button to="/upload" className="mt-6">다시 올리기</Button>
          </div>
        }

        {judged &&
        <section className="mt-8 animate-rise motion-reduce:animate-none">
            {countsFailed ?
            <div className="flex flex-wrap items-center gap-3">
                <p role="alert" className="text-body text-deny">결과 건수를 불러오지 못했습니다.</p>
                <Button
                variant="secondary"
                size="sm"
                onClick={() => setCountsAttempt((attempt) => attempt + 1)}>
                  다시 시도
                </Button>
              </div> :
            <dl className={cn('grid gap-6', awaitingCount > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
                {VERDICTS.map((verdict) =>
              <div key={verdict}>
                    <dt>
                      <Badge tone={VERDICT_META[verdict].tone} symbol={VERDICT_META[verdict].symbol}>
                        {VERDICT_LABEL[verdict]}
                      </Badge>
                    </dt>
                    <dd
                  className={cn(
                    'mt-2 text-h3 font-bold tabular-nums text-ink',
                    !byVerdict && 'invisible'
                  )}>
                      {formatNumber((byVerdict?.[verdict].count ?? 0) - (verdict === 'UNAVAILABLE' ? awaitingCount : 0))}건
                    </dd>
                  </div>
              )}
                {/* 판정이 아니라 불가에 붙는 표지라 판정 색을 쓰지 않는다 */}
                {awaitingCount > 0 &&
              <div>
                    <dt>
                      <Badge>{AWAITING_ANSWER}</Badge>
                    </dt>
                    <dd className="mt-2 text-h3 font-bold tabular-nums text-ink">{formatNumber(awaitingCount)}건</dd>
                  </div>
              }
              </dl>
            }
            <Button className="mt-8" onClick={openResults}>
              결과 보기
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          </section>
        }

        {(phase === 'failed' || finished && failedCount > 0) &&
        <section className="mt-10">
            {failedCount > 0 &&
            <h2 className="text-h4 font-bold text-ink">
                {formatNumber(failedCount)}건을 판정하지 못했습니다
              </h2>
            }
            {failures && failures.length === 0 &&
            <p className="mt-3 text-body text-ink2">어떤 거래인지 불러오지 못했습니다.</p>
            }
            {failures && failures.length > 0 &&
            <ul className="mt-4 divide-y divide-line border-y border-line">
                {failures.slice(0, FAILURES_SHOWN).map((failure) => {
                const transaction = failedTx.get(failure.transactionId);
                return (
                  <li key={failure.transactionId} className="flex items-center gap-3 py-3">
                      <span className="min-w-0 flex-1 truncate text-body text-ink">
                        {transaction ? merchantTitle(transaction) : '이름을 불러오지 못한 거래'}
                      </span>
                      {transaction &&
                    <span className="shrink-0 whitespace-nowrap text-small tabular-nums text-ink2">
                          {formatWon(transaction.amount)}
                        </span>
                    }
                      <span className="shrink-0 whitespace-nowrap text-small text-deny">
                        {FAILURE_LABEL[failure.errorCode] ?? UNKNOWN_FAILURE}
                      </span>
                    </li>);
              })}
                {failedCount > FAILURES_SHOWN &&
              <li className="py-3 text-small text-ink2">
                    외 {formatNumber(failedCount - FAILURES_SHOWN)}건
                  </li>
              }
              </ul>
            }
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
              variant={judged ? 'secondary' : 'primary'}
              disabled={retrying}
              onClick={() => void retry()}>
                {retrying ? '다시 판정하는 중…' : '다시 판정하기'}
              </Button>
              {retryFailed &&
              <p role="alert" className="text-small text-deny">
                  다시 판정하지 못했습니다. 잠시 후 다시 시도해 주세요.
                </p>
              }
            </div>
          </section>
        }
      </div>
    </AppShell>);

}
