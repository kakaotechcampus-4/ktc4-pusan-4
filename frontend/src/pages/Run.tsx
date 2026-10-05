import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRightIcon,
  CheckIcon,
  Loader2Icon,
  RadioIcon } from
'lucide-react';
import { AppShell } from '../components/AppShell';
import { useSession } from '../contexts/SessionContext';
import { api, ApiRequestError } from '../api';
import type { JudgmentRun, JudgmentRunFailure, Transaction } from '../types/domain';
import { Badge, Button, Card } from '../components/ui';
import { formatWon } from '../utils/format';
import { formatNumber } from '../utils/format';
import { VERDICT_LABEL, VERDICT_META } from '../utils/verdict';

const GATES = [
{ id: 'G0', label: '형식 검증', detail: '승인내역 여부 · 필수 컬럼 · 중복 키' },
{ id: 'G1', label: '불산입 열거', detail: '소득세법 제33조 각 호 필터' },
{ id: 'G2', label: '통상성', detail: '제27조 · 업종 프로파일 62010' },
{ id: 'G3', label: '속성 추출', detail: '자산 · 안분율 · 기간 · 한도버킷' },
{ id: 'G4', label: '금액 산정', detail: '안분 후 절사 · 상각범위액' },
{ id: 'G5', label: '한도 누적', detail: '접대비 · 기부금 버킷' },
{ id: 'G6', label: '근거 부착 검증', detail: '조문 ID 실재 확인 · 0건이면 저장 거부' }];




export function Run() {
  const navigate = useNavigate();
  const { runId, batchId, contextRef, setRunId } = useSession();
  const [run, setRun] = useState<JudgmentRun | null>(null);
  const [counts, setCounts] = useState({ available: 0, needsReview: 0, unavailable: 0 });
  const [failures, setFailures] = useState<JudgmentRunFailure[]>([]);
  const [failedTx, setFailedTx] = useState<Map<string, Transaction>>(new Map());
  const [retrying, setRetrying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  // runId 가 없으면 여기서 실행을 만든다 (확인 화면을 거치지 않고 진입한 경우)
  useEffect(() => {
    if (runId || !batchId || !contextRef) return;
    void api.runs.create({ batchId, contextId: contextRef.id }).
    then((created) => setRunId(created.id)).
    catch(() => setLoadError('판정을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
  }, [runId, batchId, contextRef, setRunId]);

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
      catch((caught: Error) => {
        // 404 는 돌아올 리 없으니 멈춘다. 그 밖의 오류는 다음 주기에 다시 해본다
        const gone = caught instanceof ApiRequestError && caught.status === 404;
        if (gone) stop();
        setLoadError(
          gone ?
          '이 판정 실행을 찾을 수 없습니다. 업로드가 지워졌을 수 있습니다.' :
          '판정 상태를 읽지 못했습니다. 다시 확인하고 있습니다.'
        );
        return null;
      }).
      then((next) => {
        inFlight = false;
        if (stopped || !next) return;
        setLoadError(null);
        setRun(next);
        const finished =
        next.status.code === 'COMPLETED' ||
        next.status.code === 'PARTIAL_FAILED' ||
        next.status.code === 'FAILED';
        if (!finished) return;

        stop();
        void api.judgments.
        summary({ runId: id }).
        then((summary) =>
        setCounts({
          available: summary.byVerdict.AVAILABLE.count,
          needsReview: summary.byVerdict.NEEDS_REVIEW.count,
          unavailable: summary.byVerdict.UNAVAILABLE.count
        })
        ).
        catch(() => setLoadError('판정은 끝났지만 집계를 읽지 못했습니다.'));

        if (next.failedCount > 0) {
          void api.runs.
          failures(id, { size: 100 }).
          then(async (page) => {
            setFailures(page.items);
            // 실패 목록은 transactionId 만 준다. 사람이 알아볼 이름을 붙인다
            const list = await api.transactions.list({ batchId: next.batchId, size: 100 });
            setFailedTx(new Map(list.items.map((t) => [t.id, t])));
          }).
          catch(() => setLoadError('실패한 거래 목록을 읽지 못했습니다.'));
        }
      });
    };

    poll();
    timer.current = window.setInterval(poll, 1000);
    return stop;
  }, [runId]);

  // runId 도 없고 만들 재료(batchId·문진)도 없으면 영원히 "판정하고 있습니다"로 남는다
  const waiting = !runId && (!batchId || !contextRef);
  const total = run?.totalCount ?? 0;
  const processed = run?.processedCount ?? 0;
  const progress = total ? Math.round(processed / total * 100) : 0;
  const status = run?.status.code;
  const done = status === 'COMPLETED' || status === 'PARTIAL_FAILED' || status === 'FAILED';
  const failed = status === 'FAILED';
  const partial = status === 'PARTIAL_FAILED';

  /** 재시도는 같은 배치·문진으로 새 Run 을 만드는 것이다 (api.md 3.6 재실행) */
  const retry = async () => {
    if (!run) return;
    setRetrying(true);
    setLoadError(null);
    try {
      const created = await api.runs.create({ batchId: run.batchId, contextId: run.contextId });
      setFailures([]);
      setRun(null);
      setRunId(created.id);
    } catch {
      setLoadError('다시 판정하지 못했습니다. 잠시 후 시도해 주세요.');
    } finally {
      setRetrying(false);
    }
  };
  const activeGate = Math.min(
    GATES.length - 1,
    Math.floor(progress / 100 * GATES.length)
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-small font-semibold text-accent">2단계 · 계획</p>
            <h1 className="mt-1.5 text-h2 font-bold tracking-tight text-ink">
              {loadError && !run ?
              '판정 상태를 확인할 수 없습니다' :
              failed ?
              '판정하지 못했습니다' :
              partial ?
              '일부를 판정하지 못했습니다' :
              done ?
              '판정을 마쳤습니다' :
              waiting ?
              '판정할 준비가 되지 않았습니다' :
              '판정하고 있습니다'}
            </h1>
          </div>
          <p className="flex items-center gap-1.5 text-caption tabular-nums text-muted">
            <RadioIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {runId ? `run ${runId.slice(0, 13)}` : '실행 없음'}
            {runId && !loadError && ' · 새로고침해도 이어집니다'}
          </p>
        </header>

        {loadError &&
        <Card as="section" padding="md" className="mt-6 border-l-[3px] border-l-deny">
            <p role="alert" className="text-body text-deny">{loadError}</p>
            <div className="mt-4 flex gap-2">
              <Button to="/upload" size="sm">카드내역 올리기</Button>
              <Button to="/uploads" variant="secondary" size="sm">업로드 이력</Button>
            </div>
          </Card>
        }

        {waiting &&
        <Card as="section" padding="md" className="mt-6">
            <p className="text-body text-ink2">
              판정에 필요한 것이 아직 없습니다.{' '}
              {!batchId ? '카드내역을 먼저 올려 주세요.' : '사업자 문진을 먼저 마쳐 주세요.'}
            </p>
            <div className="mt-4 flex gap-2">
              <Button to={!batchId ? '/upload' : '/interview'} size="sm">
                {!batchId ? '카드내역 올리기' : '문진 하러 가기'}
              </Button>
              <Button to="/uploads" variant="secondary" size="sm">업로드 이력</Button>
            </div>
          </Card>
        }

        {!loadError && !waiting &&
        <>
        <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-end justify-between gap-4">
            <p className="text-stat font-bold leading-none tabular-nums text-ink">
              {formatNumber(processed)}
              <span className="text-lead font-medium text-muted">
                {' '}
                / {formatNumber(total)}건
              </span>
            </p>
            <p className="text-small tabular-nums text-muted">
              {run?.status.label ?? ''}
            </p>
          </div>
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

          <ol className="mt-6 space-y-1">
            {GATES.map((gate, index) => {
              const gateDone = done && !partial && !failed || index < activeGate;
              const running = !done && index === activeGate;
              return (
                <li key={gate.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: index * 0.04,
                      ease: [0.23, 1, 0.32, 1]
                    }}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                    running ? 'bg-accent-soft' : ''}`
                    }>
                    
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {gateDone ?
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ok">
                          <CheckIcon
                          className="h-3 w-3 text-white"
                          strokeWidth={3}
                          aria-hidden="true" />
                        
                        </span> :
                      running ?
                      <Loader2Icon
                        className="h-4 w-4 animate-spin text-accent"
                        aria-hidden="true" /> :


                      <span className="h-2 w-2 rounded-full bg-line" />
                      }
                    </span>
                    <span className="w-8 shrink-0 text-caption font-semibold tabular-nums text-muted">
                      {gate.id}
                    </span>
                    <span
                      className={`text-body font-medium ${
                      gateDone || running ? 'text-ink' : 'text-muted'}`
                      }>
                      
                      {gate.label}
                    </span>
                    <span className="ml-auto hidden text-caption text-muted sm:block">
                      {gate.detail}
                    </span>
                  </motion.div>
                </li>);

            })}
          </ol>
          {(partial || failed) &&
          <p className="mt-3 rounded-xl bg-deny-bg px-3.5 py-2.5 text-small leading-6 text-deny">
              일부 거래가 이 경로를 끝까지 통과하지 못했습니다. 아래에서 확인하세요.
            </p>
          }
        </section>

        <Card as="section" padding="sm" className="mt-4">
          <h2 className="text-body font-semibold text-ink">이 판정의 조건</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-small sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">문진 버전</dt>
              <dd className="tabular-nums text-ink2">v{run?.contextVersion ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">판정 대상</dt>
              <dd className="tabular-nums text-ink2">{formatNumber(total)}건</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">시작</dt>
              <dd className="tabular-nums text-ink2">
                {run?.startedAt ? run.startedAt.slice(11, 16) : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">실패</dt>
              <dd className="tabular-nums text-ink2">
                {formatNumber(run?.failedCount ?? 0)}건
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-caption leading-5 text-muted">
            미분류·취소상계·대상제외 거래는 판정 대상에 넣지 않습니다. 「확인 필요」는
            정상 판정이라 실패로 세지 않습니다.
          </p>
        </Card>

        {done && (failures.length > 0 || failed) &&
        <Card as="section" padding="md" className="mt-4 border-l-[3px] border-l-deny">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-h4 font-bold text-ink">
                  {run && run.failedCount > 0 ?
                  `${formatNumber(run.failedCount)}건을 처리하지 못했습니다` :
                  '판정을 실행하지 못했습니다'}
                </h2>
                <p className="mt-1.5 max-w-xl text-small leading-6 text-muted">
                  판정 규칙을 실행하다 오류가 났습니다. 「확인 필요」와는 다른
                  기술적 실패라 결과가 아직 없습니다.
                  {run && run.failedCount > 0 &&
                  ` 나머지 ${formatNumber(run.processedCount)}건은 정상 판정됐습니다.`}
                </p>
              </div>
              <Button
              variant="secondary"
              size="sm"
              disabled={retrying}
              onClick={() => void retry()}>
              
                {retrying ? '다시 실행 중…' : '다시 판정하기'}
              </Button>
            </div>

            <ul className="mt-4 divide-y divide-line2 rounded-xl border border-line2 bg-canvas">
              {failures.slice(0, 5).map((failure) => {
              const transaction = failedTx.get(failure.transactionId);
              return (
                <li
                  key={failure.transactionId}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3.5 py-2.5">
                  
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-small font-medium text-ink">
                        {transaction?.merchantNorm ?? '거래 ' + failure.transactionId.slice(0, 8)}
                      </span>
                      <span className="block truncate text-caption text-muted">
                        {failure.message}
                      </span>
                    </span>
                    {transaction &&
                  <span className="shrink-0 text-small tabular-nums text-ink2">
                        {formatWon(transaction.amount)}
                      </span>
                  }
                    <Badge tone="deny" className="shrink-0">
                      {failure.errorCode}
                    </Badge>
                  </li>);

            })}
              {run && run.failedCount > 5 &&
            <li className="px-3.5 py-2 text-caption text-muted">
                  외 {formatNumber(run.failedCount - 5)}건
                </li>
            }
            </ul>
          </Card>
        }

        {done && !failed &&
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="mt-4 rounded-2xl border border-line bg-surface p-5">
          
            <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
              {[
            { verdict: 'AVAILABLE' as const, value: counts.available },
            { verdict: 'NEEDS_REVIEW' as const, value: counts.needsReview },
            { verdict: 'UNAVAILABLE' as const, value: counts.unavailable }].
            map((row) => ({
              term: VERDICT_LABEL[row.verdict],
              value: row.value,
              tone: `text-${VERDICT_META[row.verdict].tone}`
            })).
            map((item) =>
            <div key={item.term} className="bg-surface px-4 py-3">
                  <dt className="text-caption text-muted">{item.term}</dt>
                  <dd
                className={`mt-0.5 text-h3 font-bold tabular-nums ${item.tone}`}>
                
                    {formatNumber(item.value)}
                  </dd>
                </div>
            )}
            </dl>
            <button
            type="button"
            onClick={() => navigate('/results')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-body-lg font-semibold text-white transition-colors duration-150 ease-snap hover:bg-accent-hover">
            
              결과 보기
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </motion.section>
        }
        </>
        }
      </div>
    </AppShell>);

}