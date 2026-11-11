import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { StepEyebrow } from '../components/StepEyebrow';
import { useAssistant } from '../components/assistant/context';
import { api, ApiRequestError, isMock } from '../api';
import { useSession } from '../contexts/SessionContext';
import { merchantTitle } from '../components/results/display';
import { VerdictGrid } from '../components/results/VerdictGrid';
import { GRID_MAX, judgmentCell, type GridCell } from '../components/results/verdictCells';
import type {
  Judgment,
  JudgmentRun,
  JudgmentRunFailure,
  JudgmentSummary,
  Transaction,
  Verdict } from
'../types/domain';
import { Badge, Button, cn } from '../components/ui';
import { formatNumber, formatWon } from '../utils/format';
import { AWAITING_ANSWER, VERDICT_LABEL, VERDICT_META } from '../utils/verdict';
import { SHARE_BAR } from '../utils/shares';
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

/** 진행 중에 한 쪽에 읽는 새 판정 수. 한 쪽이 다 새것이면 다음 쪽도 읽는다 */
const ARRIVAL_PAGE = 100;
/** 한 번에 읽는 쪽 수의 끝. 띠는 GRID_MAX(1,000)건까지라 열 쪽이면 다 따라잡는다 */
const ARRIVAL_PAGES = 10;

/** 다시 물어도 같은 실패. 이때만 다른 업로드로 가는 길을 준다 */
const GONE_TEXT: Record<Exclude<PollError, 'transient'>, string> = {
  missing: isMock ?
  '체험 화면은 새로고침하면 처음 상태로 돌아갑니다.' :
  '업로드가 지워졌을 수 있습니다.',
  badAddress: '주소가 잘못됐습니다.'
};


/** 끝난 화면의 움직임. 진행 막대가 끝까지 찬 뒤 판정별로 갈리고, 칸이 차례로 올라오며 숫자가 센다 */
const EASE = [0.23, 1, 0.32, 1] as const;
const FILL_SECONDS = 0.5;
const STAGGER_SECONDS = 0.08;
const COUNT_MS = 700;

/**
 * 움직임을 줘도 되는가. 사용자가 동작 줄이기를 켰으면 끝난 모습을 바로 그린다.
 * matchMedia 가 없는 환경(테스트, 서버 렌더)도 움직이지 않는다
 */
function usePrefersMotion() {
  const [prefers] = useState(
    () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  return prefers;
}

/** 0 에서 value 까지 센다. start 가 켜진 뒤 delay 초 기다렸다가 센다 */
function CountUp({ value, start, delay, animate }: {value: number;start: boolean;delay: number;animate: boolean;}) {
  const [shown, setShown] = useState(animate ? 0 : value);
  useEffect(() => {
    if (!animate) {
      setShown(value);
      return;
    }
    if (!start) return;
    let frame = 0;
    let begin: number | null = null;
    const step = (now: number) => {
      begin ??= now + delay * 1000;
      const t = Math.min(1, Math.max(0, (now - begin) / COUNT_MS));
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, start, delay, animate]);
  return <>{formatNumber(shown)}</>;
}

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
  /** 진행 중에 읽은 판정. 도착한 순서대로 칸을 칠한다 */
  const [arrived, setArrived] = useState<Judgment[]>([]);
  /** 끝난 뒤 달로 묶은 칸. 못 읽으면 진행 중의 칸을 그대로 둔다 */
  const [monthCells, setMonthCells] = useState<GridCell[] | null>(null);
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
  /** 판정이 많으면 칸 띠 대신 진행 막대가 끝나고 판정별 몫으로 갈린다. 칸을 칠할 판정도 읽지 않는다 */
  const manyCells = (run?.totalCount ?? 0) > GRID_MAX;

  /*
   * 판정 칸 띠. 진행 중에는 이 실행의 새 판정을 1초마다 최근 판정부터 읽어 처음 본 것을 도착 순서대로 칠한다.
   * 서버가 1초에 100건 넘게 판정하면 한 쪽만 읽어서는 못 따라가 칸이 회색으로 남았다. 한 쪽이 다 새것이면
   * 이미 본 판정이 나올 때까지 다음 쪽을 읽는다(ARRIVAL_PAGES 까지). 끝나면 멈추고, 아래에서 달로 묶은 띠로 바꾼다
   */
  useEffect(() => {
    if (!runId || phase !== 'running' || manyCells) return;
    const id = runId;
    let stopped = false;
    let inFlight = false;
    const seen = new Set<string>();
    const read = async () => {
      if (inFlight || stopped) return;
      inFlight = true;
      const fresh: Judgment[] = [];
      try {
        for (let page = 0; page < ARRIVAL_PAGES; page += 1) {
          const result = await api.judgments.list({ runId: id, page, size: ARRIVAL_PAGE });
          if (stopped) return;
          const unseen = result.items.filter((judgment) => !seen.has(judgment.transactionId));
          // 읽는 사이 새 판정이 들어오면 앞 쪽 행이 다음 쪽으로 밀려 다시 온다
          unseen.forEach((judgment) => seen.add(judgment.transactionId));
          fresh.push(...unseen);
          if (unseen.length < result.items.length || !result.page.hasNext) break;
        }
      } catch {
        // 칸을 못 칠해도 진행은 위의 처리 수가 보인다. 다음 주기에 다시 읽는다
      } finally {
        inFlight = false;
      }
      if (stopped || fresh.length === 0) return;
      // 최근 판정부터 왔다. 먼저 난 것부터 칠한다
      setArrived((prev) => [...prev, ...fresh.reverse()]);
    };
    void read();
    const interval = window.setInterval(() => void read(), 1000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [runId, phase, manyCells]);

  // 끝나면 이 업로드의 판정을 한 번 읽어 달로 묶는다. 결과 화면의 띠와 같은 모양이다
  useEffect(() => {
    if (!judged || !runBatchId || manyCells) return;
    let cancelled = false;
    void api.judgments.export({ batchId: runBatchId }).then(
      ({ items }) => {
        if (!cancelled && items.length > 0) setMonthCells(items.map((row) => judgmentCell(row.judgment)));
      },
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, [judged, runBatchId, manyCells]);

  // 집계를 못 읽어도 판정은 끝났다. 결과 보기는 그대로 두고 그 자리에서 다시 읽게 한다 (C62)
  // 답변 대기(불가 가운데 답을 기다리는 거래)도 요약이 함께 센다 (C12)
  useEffect(() => {
    if (!runId || !judged) return;
    let cancelled = false;
    setCountsFailed(false);
    void api.judgments.summary({ runId }).
    then(
      (summary) => {
        if (cancelled) return;
        setAwaitingCount(summary.awaiting.count);
        setByVerdict(summary.byVerdict);
      },
      () => {
        if (!cancelled) setCountsFailed(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [runId, judged, countsAttempt]);

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

  const animate = usePrefersMotion();
  const total = run?.totalCount ?? 0;
  const processed = run?.processedCount ?? 0;
  /** 다 마치면 끝까지 차고, 일부만 마쳤으면 판정한 몫까지만 찬다(못 한 몫은 빈 칸으로 남는다) */
  const progress = phase === 'completed' ? 100 : total ? Math.round(processed / total * 100) : 0;
  /** 끝난 칸. 판정별 건수를 다 받았을 때만 움직임을 시작한다 */
  const tiles = byVerdict ?
  [
  ...VERDICTS.map((verdict) => ({
    key: verdict,
    badge:
    <Badge tone={VERDICT_META[verdict].tone} symbol={VERDICT_META[verdict].symbol}>
            {VERDICT_LABEL[verdict]}
          </Badge>,
    count: byVerdict[verdict].count - (verdict === 'UNAVAILABLE' ? awaitingCount : 0),
    bar: SHARE_BAR[verdict]
  })),
  ...(awaitingCount > 0 ? [{ key: 'AWAITING', badge: <Badge symbol="wait">{AWAITING_ANSWER}</Badge>, count: awaitingCount, bar: SHARE_BAR.AWAITING }] : [])] :
  null;
  const tileTotal = tiles?.reduce((sum, tile) => sum + tile.count, 0) ?? 0;
  /** 막대가 다 찬 뒤 칸이 올라온다 */
  const settleDelay = animate ? FILL_SECONDS : 0;
  const motionOf = (delay: number, seconds = 0.32) =>
  animate ? { duration: seconds, delay, ease: EASE } : { duration: 0 };
  const goneText =
  pollError === 'missing' || pollError === 'badAddress' ? GONE_TEXT[pollError] : null;
  /**
   * 진행 중의 칸. 읽은 판정, 처리했지만 아직 못 읽은 몫(한 번에 100건 넘게 났을 때), 아직 판정 전 순이다.
   * 칸은 자리로 이름을 붙여, 판정이 오면 그 자리의 칸이 뒤집힌다
   */
  const runCells: GridCell[] = (() => {
    if (!run || total === 0 || manyCells) return [];
    const done = phase === 'completed' ? total : processed;
    const unseen = Math.max(0, done - arrived.length);
    return Array.from({ length: total }, (_, index): GridCell => {
      const judgment = arrived[index];
      if (judgment) return { ...judgmentCell(judgment), key: `run-${index}` };
      return { key: `run-${index}`, state: index < arrived.length + unseen ? 'SEEN' : 'PENDING' };
    });
  })();
  const gridCells = monthCells ?? runCells;

  return (
    <AppShell narrow>
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

        {/* 진행과 끝난 칸을 한 판에 둔다. 결과와 요약 머리의 판과 같은 모양이다 */}
        {!goneText && (!finished || judged) &&
        <div className="hero-wash mt-8 rounded-2xl p-6 sm:p-8">
            <p aria-live="polite" className="text-stat font-bold leading-none tabular-nums text-ink">
              {run ?
              <>
                  {formatNumber(phase === 'completed' ? total : processed)}
                  <span className="text-lead font-normal text-ink2"> / {formatNumber(total)}건</span>
                </> :
              <span className="invisible">0</span>}
            </p>
            {/*
              진행 막대는 진행만 보인다. 끝나면 끝까지 찬다. 판정별 몫은 아래 칸 띠와 건수 칸이 보여서 막대를 판정색으로 나누지 않는다(11/11 치오).
              칸 띠를 그리지 않는 큰 업로드(GRID_MAX 초과)는 끝까지 찬 뒤 막대가 판정별 몫으로 갈린다. 결과 화면의 막대와 같다
            */}
            <div
            className="relative mt-5 h-3 overflow-hidden rounded-full bg-line"
            role={judged ? undefined : 'progressbar'}
            aria-hidden={judged ? true : undefined}
            aria-valuenow={judged ? undefined : progress}
            aria-valuemin={judged ? undefined : 0}
            aria-valuemax={judged ? undefined : 100}
            aria-label={judged ? undefined : '판정 진행률'}>
              <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={animate ? { duration: judged ? FILL_SECONDS : 0.3, ease: EASE } : { duration: 0 }} />
              {manyCells && tiles && tileTotal > 0 &&
              <motion.div
                className="absolute inset-y-0 left-0 flex gap-0.5 bg-line"
                style={{ width: `${progress}%` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={motionOf(settleDelay, 0.24)}>
                  {tiles.filter((tile) => tile.count > 0).map((tile) =>
                <span key={tile.key} className={tile.bar} style={{ flex: `${tile.count} 1 0` }} />
                )}
                </motion.div>
              }
            </div>
            {/* 판정 칸 띠. 진행 중에는 회색 칸이 판정이 나는 대로 뒤집히고, 끝나면 달로 묶인다 */}
            {gridCells.length > 0 &&
            <div key={monthCells ? 'month' : 'run'} className={cn('mt-6', monthCells && 'motion-safe:animate-enter')}>
                <VerdictGrid cells={gridCells} byMonth={Boolean(monthCells)} legend={false} fit animate={Boolean(monthCells)} />
              </div>
            }
            {judged && <div className="mt-6">
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
            <dl className={cn('grid gap-3', tiles && tiles.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
                {(tiles ?? VERDICTS.map((verdict) => ({ key: verdict, badge: null, count: 0 }))).map((tile, index) =>
              <motion.div
                key={tile.key}
                className={cn('rounded-xl bg-canvas px-4 py-4 sm:px-5', !tiles && 'invisible')}
                initial={animate ? { opacity: 0, y: 8 } : false}
                animate={tiles ? { opacity: 1, y: 0 } : undefined}
                transition={motionOf(settleDelay + index * STAGGER_SECONDS)}>
                    {/* 기호 그림이 든 배지는 글줄 기준선이 그림을 따라 올라간다. flex 로 놓아 네 칸의 배지 윗변을 맞춘다 */}
                    <dt className="flex">{tile.badge}</dt>
                    <dd className="mt-3 text-h3 font-bold tabular-nums text-ink">
                      <CountUp
                    value={tile.count}
                    start={Boolean(tiles)}
                    delay={settleDelay + index * STAGGER_SECONDS}
                    animate={animate} />
                      건
                    </dd>
                  </motion.div>
              )}
              </dl>
            }
            </div>}
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
        <section>
            {/* 보이기 전에는 visibility 로 숨겨 투명한 채로 초점이 가거나 눌리지 않게 한다 */}
            <div
            className={cn(
              animate && 'transition-[opacity,visibility] duration-300',
              tiles || countsFailed ? 'visible opacity-100' : 'invisible opacity-0'
            )}
            style={animate && tiles ? { transitionDelay: `${settleDelay + tiles.length * STAGGER_SECONDS + 0.1}s` } : undefined}>
              <Button className="mt-8" onClick={openResults}>
                결과 보기
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
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
                {retrying ? '다시 판정하는 중' : '다시 판정하기'}
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
