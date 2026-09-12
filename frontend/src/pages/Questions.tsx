import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightIcon, CheckIcon, LayersIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useSession } from '../contexts/SessionContext';
import { QUESTION_GROUPS } from '../mock/judgments';
import { formatNumber, formatWon } from '../utils/format';

export function Questions() {
  const { answers, answerGroup, counts } = useSession();
  const [customRatio, setCustomRatio] = useState<Record<string, string>>({});

  const remaining = QUESTION_GROUPS.filter(
    (group) => !answers[group.groupKey]
  ).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-accent">사람 게이트 ②</p>
            <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-ink">
              확인이 필요한 것만 물어봅니다
            </h1>
            <p className="mt-2 max-w-xl text-[14px] leading-6 text-ink2">
              292건을 한 건씩 묻지 않습니다. 같은 사유·같은 가맹점끼리 묶어{' '}
              {QUESTION_GROUPS.length}개 질문으로 줄였습니다.
            </p>
          </div>
          <Link
            to="/results"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 ease-snap hover:bg-line2">
            
            결과로 돌아가기
          </Link>
        </header>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] tabular-nums">
          <span className="text-muted">
            남은 질문{' '}
            <strong className="font-semibold text-ink">{remaining}개</strong>
          </span>
          <span className="text-muted">
            확인 필요{' '}
            <strong className="font-semibold text-warn">
              {formatNumber(counts.needsReview)}건
            </strong>
          </span>
        </div>

        <ol className="mt-4 space-y-3">
          {QUESTION_GROUPS.map((group, index) => {
            const answer = answers[group.groupKey];
            const answered = Boolean(answer);
            const selectedLabel = group.options.find(
              (option) => option.value === answer
            )?.label;

            return (
              <li key={group.groupKey}>
                <section
                  className={`overflow-hidden rounded-2xl border bg-surface transition-colors duration-200 ease-snap ${
                  answered ? 'border-ok-line' : 'border-line'}`
                  }>
                  
                  <header className="flex flex-wrap items-start gap-3 border-b border-line2 px-5 py-4">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-canvas text-[12px] font-semibold tabular-nums text-ink2">
                      {answered ?
                      <CheckIcon
                        className="h-3.5 w-3.5 text-ok"
                        strokeWidth={3}
                        aria-hidden="true" /> :


                      index + 1
                      }
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-warn-bg px-1.5 py-0.5 text-[11px] font-semibold text-warn">
                          {group.reasonLabel}
                        </span>
                        <span className="flex items-center gap-1 text-[12px] tabular-nums text-muted">
                          <LayersIcon className="h-3 w-3" aria-hidden="true" />
                          {group.count}건 · {formatWon(group.amount)}
                        </span>
                      </div>
                      <h2 className="mt-2 text-[16px] font-semibold text-ink">
                        {group.question}
                      </h2>
                      <p className="mt-1 text-[13px] leading-6 text-muted">
                        {group.helper}
                      </p>
                      <p className="mt-2 text-[12px] text-muted">
                        묶인 가맹점: {group.sampleMerchants.join(' · ')}
                      </p>
                    </div>
                  </header>

                  <div className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      {group.options.map((option) => {
                        const active = answer === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                            answerGroup(group.groupKey, option.value)
                            }
                            className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-150 ease-snap ${
                            active ?
                            'border-accent bg-accent-soft' :
                            'border-line bg-surface hover:bg-canvas'}`
                            }>
                            
                            <span
                              className={`block text-[13px] font-semibold ${
                              active ? 'text-accent' : 'text-ink'}`
                              }>
                              
                              {option.label}
                            </span>
                            {option.hint &&
                            <span className="mt-0.5 block text-[12px] text-muted">
                                {option.hint}
                              </span>
                            }
                          </button>);

                      })}

                      {group.answerType === 'RATIO' &&
                      <div className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
                          <input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="직접 입력"
                          value={customRatio[group.groupKey] ?? ''}
                          onChange={(event) =>
                          setCustomRatio((prev) => ({
                            ...prev,
                            [group.groupKey]: event.target.value
                          }))
                          }
                          aria-label="업무 사용 비율 직접 입력"
                          className="w-24 text-[13px] tabular-nums text-ink outline-none" />
                        
                          <button
                          type="button"
                          onClick={() => {
                            const value = customRatio[group.groupKey];
                            if (value) answerGroup(group.groupKey, value);
                          }}
                          className="text-[13px] font-semibold text-accent">
                          
                            적용
                          </button>
                        </div>
                      }
                    </div>

                    <AnimatePresence initial={false}>
                      {answered &&
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: 0.18,
                          ease: [0.23, 1, 0.32, 1]
                        }}
                        className="mt-3 text-[13px] leading-6 text-ok">
                        
                          {selectedLabel ?? `${answer}%`}로 저장하고 {group.count}건을
                          재판정했습니다. 새 판정 이력이 추가되고 이전 판정도 그대로
                          남습니다.
                        </motion.p>
                      }
                    </AnimatePresence>
                  </div>
                </section>
              </li>);

          })}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            to="/summary"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-[15px] font-semibold text-white transition-colors duration-150 ease-snap hover:bg-accent-hover">
            
            요약으로
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="text-[13px] text-muted">
            모르는 건 건너뛰어도 됩니다. 남은 건은 세무 상담 핸드오프 목록으로
            모입니다.
          </p>
        </div>
      </div>
    </AppShell>);

}