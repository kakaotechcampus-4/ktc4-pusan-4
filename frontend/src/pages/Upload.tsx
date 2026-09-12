import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  Loader2Icon,
  ScissorsIcon,
  UploadCloudIcon } from
'lucide-react';
import { AppShell } from '../components/AppShell';
import { useSession } from '../contexts/SessionContext';
import {
  COLUMN_MAPPING,
  DISCARDED_COLUMNS,
  SAMPLE_FILES,
  TARGET_FIELDS } from
'../mock/sampleFiles';
import type { SampleFile } from '../types/domain';
import { formatNumber, formatPeriod } from '../utils/format';

type Phase = 'IDLE' | 'PARSING' | 'BLOCKED' | 'MAPPING' | 'READY';

export function Upload() {
  const navigate = useNavigate();
  const { setBatch } = useSession();
  const [phase, setPhase] = useState<Phase>('IDLE');
  const [file, setFile] = useState<SampleFile | null>(null);
  const [progress, setProgress] = useState(0);
  const [headerRow, setHeaderRow] = useState(4);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
    },
    []
  );

  const startParse = useCallback((sample: SampleFile) => {
    setFile(sample);
    setHeaderRow(sample.headerRow);
    setProgress(0);
    setPhase('PARSING');

    timer.current = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + 12;
        if (next >= 100) {
          if (timer.current) window.clearInterval(timer.current);
          setPhase(sample.sourceType === 'BILLING' ? 'BLOCKED' : 'MAPPING');
          return 100;
        }
        return next;
      });
    }, 90);
  }, []);

  const confirmMapping = () => {
    if (!file) return;
    setBatch({
      fileName: file.fileName,
      issuer: file.issuer,
      format: file.format,
      rowCount: file.rowCount,
      periodStart: file.periodStart,
      periodEnd: file.periodEnd,
      encoding: file.encoding
    });
    setPhase('READY');
  };

  const reset = () => {
    setPhase('IDLE');
    setFile(null);
    setProgress(0);
  };

  return (
    <AppShell>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <header>
            <p className="text-[13px] font-semibold text-accent">1단계 · 인식</p>
            <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-ink">
              카드내역 올리기
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-6 text-ink2">
              파일은 브라우저 안에서만 열립니다. 컬럼을 확인한 뒤 날짜 · 가맹점명 ·
              금액만 서버로 보냅니다.
            </p>
          </header>

          <div className="mt-6">
            <AnimatePresence mode="wait">
              {phase === 'IDLE' &&
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}>
                
                  <div className="rounded-2xl border-2 border-dashed border-line bg-surface px-6 py-12 text-center">
                    <UploadCloudIcon
                    className="mx-auto h-8 w-8 text-muted"
                    aria-hidden="true" />
                  
                    <p className="mt-3 text-[15px] font-semibold text-ink">
                      승인내역 파일을 여기에 끌어다 놓으세요
                    </p>
                    <p className="mt-1 text-[13px] text-muted">
                      XLSX · CSV · 최대 5MB · EUC-KR 자동 감지
                    </p>
                    <button
                    type="button"
                    onClick={() => startParse(SAMPLE_FILES[0])}
                    className="mt-5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 ease-snap hover:bg-accent-hover">
                    
                      파일 선택
                    </button>
                  </div>

                  <h2 className="mt-7 text-sm font-semibold text-ink">
                    샘플 파일로 시작
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {SAMPLE_FILES.map((sample) =>
                  <li key={sample.id}>
                        <button
                      type="button"
                      onClick={() => startParse(sample)}
                      className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors duration-150 ease-snap hover:border-accent-line hover:bg-accent-soft">
                      
                          <FileSpreadsheetIcon
                        className="h-4 w-4 shrink-0 text-muted"
                        aria-hidden="true" />
                      
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium text-ink">
                              {sample.fileName}
                            </span>
                            <span className="mt-0.5 block text-[12px] tabular-nums text-muted">
                              {sample.issuer} · {formatNumber(sample.rowCount)}행 ·{' '}
                              {sample.encoding}
                              {sample.sourceType === 'BILLING' && ' · 청구내역'}
                            </span>
                          </span>
                          <ArrowRightIcon
                        className="h-4 w-4 shrink-0 text-muted"
                        aria-hidden="true" />
                      
                        </button>
                      </li>
                  )}
                  </ul>
                </motion.div>
              }

              {phase === 'PARSING' &&
              <motion.div
                key="parsing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="rounded-2xl border border-line bg-surface p-6">
                
                  <div className="flex items-center gap-2.5">
                    <Loader2Icon
                    className="h-4 w-4 animate-spin text-accent"
                    aria-hidden="true" />
                  
                    <p className="text-[15px] font-semibold text-ink">
                      브라우저에서 파싱 중
                    </p>
                  </div>
                  <p className="mt-1.5 text-[13px] text-muted">
                    {file?.fileName} · Web Worker · 인코딩 {file?.encoding} 감지
                  </p>
                  <div
                  className="mt-4 h-1.5 overflow-hidden rounded-full bg-line2"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}>
                  
                    <div
                    className="h-full rounded-full bg-accent transition-[width] duration-150 ease-out"
                    style={{ width: `${progress}%` }} />
                  
                  </div>
                </motion.div>
              }

              {phase === 'BLOCKED' && file &&
              <motion.div
                key="blocked"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="rounded-2xl border border-deny-line bg-deny-bg p-6">
                
                  <div className="flex items-start gap-3">
                    <AlertTriangleIcon
                    className="mt-0.5 h-5 w-5 shrink-0 text-deny"
                    aria-hidden="true" />
                  
                    <div>
                      <h2 className="text-[15px] font-semibold text-deny">
                        청구내역이라 판정할 수 없습니다
                      </h2>
                      <p className="mt-2 max-w-xl text-[13px] leading-6 text-ink2">
                        청구내역은 할부가 회차별로 쪼개져 있어, 350만원 자산 1건이
                        29만원 12건으로 보입니다. 이대로 판정하면 자산 판정을 빠져나가
                        실제 불가를 가능으로 내보낼 수 있어 업로드를 막았습니다.
                      </p>
                      <div className="mt-4 rounded-xl border border-deny-line bg-surface p-4">
                        <h3 className="text-[13px] font-semibold text-ink">
                          승인내역 받는 방법
                        </h3>
                        <ol className="mt-2 space-y-1 text-[13px] leading-6 text-ink2">
                          <li>1. 홈택스 → 전자(세금)계산서·현금영수증·신용카드</li>
                          <li>2. 신용카드 매입 → 사업용신용카드 사용내역 조회</li>
                          <li>3. 조회 기간 선택 후 엑셀 내려받기</li>
                        </ol>
                      </div>
                      <button
                      type="button"
                      onClick={reset}
                      className="mt-4 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 ease-snap hover:bg-line2">
                      
                        다른 파일 올리기
                      </button>
                    </div>
                  </div>
                </motion.div>
              }

              {phase === 'MAPPING' && file &&
              <motion.div
                key="mapping"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="rounded-2xl border border-line bg-surface">
                
                  <div className="border-b border-line px-6 py-4">
                    <h2 className="text-[15px] font-semibold text-ink">
                      컬럼 매핑 확인
                    </h2>
                    <p className="mt-1 text-[13px] text-muted">
                      {file.issuer} 어댑터가 자동으로 매핑했습니다. 어긋난 항목만
                      고쳐주세요.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 border-b border-line px-6 py-3.5">
                    <label
                    htmlFor="headerRow"
                    className="text-[13px] font-medium text-ink2">
                    
                      헤더 행 위치
                    </label>
                    <input
                    id="headerRow"
                    type="number"
                    min={1}
                    max={20}
                    value={headerRow}
                    onChange={(event) =>
                    setHeaderRow(Number(event.target.value))
                    }
                    className="w-20 rounded-lg border border-line px-2.5 py-1.5 text-sm tabular-nums text-ink" />
                  
                    <span className="text-[12px] text-muted">
                      {headerRow}행을 컬럼명으로 읽습니다
                    </span>
                  </div>

                  <ul className="divide-y divide-line2">
                    {COLUMN_MAPPING.map((column) =>
                  <li
                    key={column.source}
                    className="flex items-center gap-3 px-6 py-3">
                    
                        <span className="w-32 shrink-0 truncate rounded-md bg-canvas px-2 py-1 text-[12px] text-ink2">
                          {column.source}
                        </span>
                        <ArrowRightIcon
                      className="h-3.5 w-3.5 shrink-0 text-muted"
                      aria-hidden="true" />
                    
                        <select
                      defaultValue={column.target}
                      aria-label={`${column.source} 매핑 대상`}
                      className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink">
                      
                          {TARGET_FIELDS.map((field) =>
                      <option key={field.value} value={field.value}>
                              {field.label}
                            </option>
                      )}
                        </select>
                        {column.required &&
                    <span className="shrink-0 text-[11px] font-semibold text-accent">
                            필수
                          </span>
                    }
                      </li>
                  )}
                  </ul>

                  <div className="flex items-start gap-2.5 border-t border-line bg-canvas px-6 py-4">
                    <ScissorsIcon
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted"
                    aria-hidden="true" />
                  
                    <p className="text-[13px] leading-6 text-ink2">
                      <strong className="font-semibold">
                        {DISCARDED_COLUMNS.join(' · ')}
                      </strong>{' '}
                      컬럼은 파싱 단계에서 폐기됩니다. 서버로 전송되는 값에 포함되지
                      않습니다.
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
                    <button
                    type="button"
                    onClick={reset}
                    className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink">
                    
                      취소
                    </button>
                    <button
                    type="button"
                    onClick={confirmMapping}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 ease-snap hover:bg-accent-hover">
                    
                      매핑 확정
                      <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </motion.div>
              }

              {phase === 'READY' && file &&
              <motion.div
                key="ready"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="rounded-2xl border border-line bg-surface p-6">
                
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2Icon
                    className="h-5 w-5 text-ok"
                    aria-hidden="true" />
                  
                    <h2 className="text-[15px] font-semibold text-ink">
                      {formatNumber(file.rowCount)}건을 읽었습니다
                    </h2>
                  </div>

                  <dl className="mt-5 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
                    {[
                  { term: '파일', value: file.fileName },
                  { term: '카드사 어댑터', value: file.issuer },
                  {
                    term: '기간',
                    value: formatPeriod(file.periodStart, file.periodEnd)
                  },
                  { term: '내역 종류', value: '승인내역 (게이트 0 통과)' }].
                  map((item) =>
                  <div key={item.term} className="bg-surface px-4 py-3">
                        <dt className="text-[12px] text-muted">{item.term}</dt>
                        <dd className="mt-0.5 truncate text-[13px] font-medium text-ink">
                          {item.value}
                        </dd>
                      </div>
                  )}
                  </dl>

                  <ul className="mt-4 space-y-1.5 text-[13px] leading-6 text-ink2">
                    <li>· 취소·환불 3건을 상계 처리했습니다.</li>
                    <li>
                      · 이전 배치와 겹치는 12건은 중복 계상을 막기 위해 제외했습니다.
                    </li>
                    <li>· 카드번호 컬럼은 파싱 결과에 존재하지 않습니다.</li>
                  </ul>

                  <div className="mt-6 flex items-center gap-3">
                    <button
                    type="button"
                    onClick={() => navigate('/interview')}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 ease-snap hover:bg-accent-hover">
                    
                      다음: 사업자 문진
                      <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                    type="button"
                    onClick={reset}
                    className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink">
                    
                      다시 올리기
                    </button>
                  </div>
                </motion.div>
              }
            </AnimatePresence>
          </div>
        </div>

        <aside className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">데이터 경계</h2>
          <div className="mt-4 space-y-4 text-[13px] leading-6">
            <div>
              <p className="font-semibold text-ink">브라우저에 남는 것</p>
              <p className="mt-0.5 text-muted">
                원본 파일, 카드번호, 계좌번호, 승인번호
              </p>
            </div>
            <div className="h-px bg-line2" />
            <div>
              <p className="font-semibold text-ink">서버로 보내는 것</p>
              <p className="mt-0.5 text-muted">
                승인일, 가맹점명, 승인금액, 할부 개월, 파일 해시
              </p>
            </div>
            <div className="h-px bg-line2" />
            <div>
              <p className="font-semibold text-ink">로그에 남지 않는 것</p>
              <p className="mt-0.5 text-muted">소득 금액, 이름</p>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>);

}