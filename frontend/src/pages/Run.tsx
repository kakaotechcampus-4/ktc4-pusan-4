import React, { useEffect, useRef, useState } from 'react';
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
import { BATCH_SUMMARY } from '../mock/judgments';
import { formatNumber } from '../utils/format';

const GATES = [
{ id: 'G0', label: '형식 검증', detail: '승인내역 여부 · 필수 컬럼 · 중복 키' },
{ id: 'G1', label: '불산입 열거', detail: '소득세법 제33조 각 호 필터' },
{ id: 'G2', label: '통상성', detail: '제27조 · 업종 프로파일 62010' },
{ id: 'G3', label: '속성 추출', detail: '자산 · 안분율 · 기간 · 한도버킷' },
{ id: 'G4', label: '금액 산정', detail: '안분 후 절사 · 상각범위액' },
{ id: 'G5', label: '한도 누적', detail: '접대비 · 기부금 버킷' },
{ id: 'G6', label: '근거 부착 검증', detail: '조문 ID 실재 확인 · 0건이면 저장 거부' }];


const CALL_LOG = [
{ at: 12, text: '가맹점 사전 조회 292건 · 미해결 6건' },
{ at: 26, text: '가맹점 분류 배치 호출 1회 (건별 호출 없음)' },
{ at: 44, text: '법령 조문 캐시 적중 41건' },
{ at: 58, text: '국가법령정보 API 호출 6건 · 실패 0건' },
{ at: 76, text: '속성 추출 배치 호출 1회 · 타임아웃 0건' },
{ at: 92, text: '조문 ID 실재 검증 통과 · 근거 0건 저장 거부 0건' }];


export function Run() {
  const navigate = useNavigate();
  const { setRunStatus, counts } = useSession();
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    timer.current = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + 2;
        if (next >= 100) {
          if (timer.current) window.clearInterval(timer.current);
          return 100;
        }
        return next;
      });
    }, 70);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  useEffect(() => {
    if (progress >= 100) setRunStatus('DONE');
  }, [progress, setRunStatus]);

  const processed = Math.round(progress / 100 * BATCH_SUMMARY.total);
  const done = progress >= 100;
  const activeGate = Math.min(
    GATES.length - 1,
    Math.floor(progress / 100 * GATES.length)
  );
  const visibleLogs = CALL_LOG.filter((entry) => entry.at <= progress);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-accent">2단계 · 계획</p>
            <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-ink">
              {done ? '판정을 마쳤습니다' : '판정하고 있습니다'}
            </h1>
          </div>
          <p className="flex items-center gap-1.5 text-[12px] tabular-nums text-muted">
            <RadioIcon className="h-3.5 w-3.5" aria-hidden="true" />
            run 019e4c · 새로고침해도 이어집니다
          </p>
        </header>

        <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-end justify-between gap-4">
            <p className="text-[32px] font-bold leading-none tabular-nums text-ink">
              {formatNumber(processed)}
              <span className="text-[16px] font-medium text-muted">
                {' '}
                / {formatNumber(BATCH_SUMMARY.total)}건
              </span>
            </p>
            <p className="text-[13px] tabular-nums text-muted">
              {done ? '완료' : '예상 남은 시간 약 40초'}
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
              const gateDone = done || index < activeGate;
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
                    <span className="w-8 shrink-0 text-[12px] font-semibold tabular-nums text-muted">
                      {gate.id}
                    </span>
                    <span
                      className={`text-[14px] font-medium ${
                      gateDone || running ? 'text-ink' : 'text-muted'}`
                      }>
                      
                      {gate.label}
                    </span>
                    <span className="ml-auto hidden text-[12px] text-muted sm:block">
                      {gate.detail}
                    </span>
                  </motion.div>
                </li>);

            })}
          </ol>
        </section>

        <section className="mt-4 rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">거쳐온 경로</h2>
          <p className="mt-1 text-[13px] text-muted">
            답이 맞아도 붙여둔 API를 부르지 않았다면 실패로 봅니다. 호출 이력을 판정에
            함께 저장합니다.
          </p>
          <ul className="mt-3 space-y-1.5">
            {visibleLogs.map((entry) =>
            <motion.li
              key={entry.text}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2 text-[13px] tabular-nums text-ink2">
              
                <CheckIcon
                className="h-3.5 w-3.5 shrink-0 text-ok"
                aria-hidden="true" />
              
                {entry.text}
              </motion.li>
            )}
            {visibleLogs.length === 0 &&
            <li className="text-[13px] text-muted">호출 대기 중…</li>
            }
          </ul>
        </section>

        {done &&
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="mt-4 rounded-2xl border border-line bg-surface p-5">
          
            <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
              {[
            { term: '가능', value: counts.possible, tone: 'text-ok' },
            {
              term: '확인 필요',
              value: counts.needsReview,
              tone: 'text-warn'
            },
            { term: '불가', value: counts.impossible, tone: 'text-deny' }].
            map((item) =>
            <div key={item.term} className="bg-surface px-4 py-3">
                  <dt className="text-[12px] text-muted">{item.term}</dt>
                  <dd
                className={`mt-0.5 text-[22px] font-bold tabular-nums ${item.tone}`}>
                
                    {formatNumber(item.value)}
                  </dd>
                </div>
            )}
            </dl>
            <button
            type="button"
            onClick={() => navigate('/results')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-[15px] font-semibold text-white transition-colors duration-150 ease-snap hover:bg-accent-hover">
            
              결과 보기
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </motion.section>
        }
      </div>
    </AppShell>);

}