import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckIcon, PlayIcon, ShieldCheckIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { DEFAULT_CONTEXT, useSession } from '../contexts/SessionContext';
import { formatFullDate, formatNumber, formatPeriod } from '../utils/format';

export function Confirm() {
  const navigate = useNavigate();
  const { batch, context, setRunStatus } = useSession();
  const [agreed, setAgreed] = useState(false);
  const resolved = context ?? DEFAULT_CONTEXT;

  const start = () => {
    setRunStatus('RUNNING');
    navigate('/run');
  };

  const batchRows = [
  { term: '파일', value: batch?.fileName ?? '사업용신용카드_승인내역_202601.xlsx' },
  { term: '카드사 어댑터', value: batch?.issuer ?? '홈택스 사업용카드' },
  {
    term: '판정 대상',
    value: `${formatNumber(batch?.rowCount ?? 292)}건 (취소 상계·중복 제외 후)`
  },
  {
    term: '기간',
    value: formatPeriod(
      batch?.periodStart ?? '2026-01-01',
      batch?.periodEnd ?? '2026-01-31'
    )
  }];


  const contextRows = [
  { term: '업종', value: `${resolved.industryCode} · 컴퓨터 프로그래밍` },
  {
    term: '직전연도 수입금액',
    value: `${formatNumber(resolved.prevYearRevenue)}원`
  },
  { term: '개업일', value: formatFullDate(resolved.businessOpenDate) },
  { term: '직원', value: resolved.hasEmployees ? '있음' : '없음 (1인)' },
  {
    term: '작업 공간',
    value:
    resolved.workplaceType === 'HOME' ?
    `자택 겸용 · 면적 ${resolved.homeOfficeRatio}%` :
    resolved.workplaceType === 'OFFICE' ?
    '별도 사무실' :
    '고정 작업장 없음'
  },
  { term: '사업용 차량', value: resolved.hasVehicle ? '있음' : '없음' }];


  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <header>
          <p className="text-[13px] font-semibold text-accent">사람 게이트 ①</p>
          <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-ink">
            이 입력으로 판정합니다
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-ink2">
            판정은 입력을 바꾸지 않으면 항상 같은 결과를 냅니다. 시작 전에 두 입력이
            맞는지만 확인해 주세요.
          </p>
        </header>

        <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3.5 text-sm font-semibold text-ink">
            카드내역
          </h2>
          <dl className="divide-y divide-line2">
            {batchRows.map((row) =>
            <div key={row.term} className="flex gap-4 px-5 py-3">
                <dt className="w-36 shrink-0 text-[13px] text-muted">
                  {row.term}
                </dt>
                <dd className="text-[13px] font-medium text-ink">{row.value}</dd>
              </div>
            )}
          </dl>
          <div className="border-t border-line bg-canvas px-5 py-3">
            <Link
              to="/upload"
              className="text-[13px] font-semibold text-accent transition-colors duration-150 hover:text-accent-hover">
              
              카드내역 다시 올리기
            </Link>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3.5 text-sm font-semibold text-ink">
            사업자 문진 · 버전 4
          </h2>
          <dl className="divide-y divide-line2">
            {contextRows.map((row) =>
            <div key={row.term} className="flex gap-4 px-5 py-3">
                <dt className="w-36 shrink-0 text-[13px] text-muted">
                  {row.term}
                </dt>
                <dd className="text-[13px] font-medium tabular-nums text-ink">
                  {row.value}
                </dd>
              </div>
            )}
          </dl>
          <div className="border-t border-line bg-canvas px-5 py-3">
            <Link
              to="/interview"
              className="text-[13px] font-semibold text-accent transition-colors duration-150 hover:text-accent-hover">
              
              문진 수정하기
            </Link>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-start gap-2.5">
            <ShieldCheckIcon
              className="mt-0.5 h-4 w-4 shrink-0 text-ok"
              aria-hidden="true" />
            
            <div>
              <h2 className="text-sm font-semibold text-ink">
                되돌릴 수 없는 동작은 없습니다
              </h2>
              <p className="mt-1.5 text-[13px] leading-6 text-muted">
                판정은 신고·제출·발송·금전 이동을 만들지 않습니다. 결과는 언제든 다시
                계산할 수 있고, 답변을 고치면 새 판정 이력이 쌓입니다.
              </p>
            </div>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl bg-canvas p-3.5">
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 ${
              agreed ? 'border-accent bg-accent' : 'border-line bg-surface'}`
              }>
              
              {agreed &&
              <CheckIcon
                className="h-3 w-3 text-white"
                aria-hidden="true"
                strokeWidth={3} />

              }
            </span>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="sr-only" />
            
            <span className="text-[13px] leading-6 text-ink2">
              이 결과가 세무 신고를 확정하는 것이 아니며, 최종 판단에는 세무대리인의
              확인이 필요하다는 점을 이해했습니다.
            </span>
          </label>

          <button
            type="button"
            disabled={!agreed}
            onClick={start}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-[15px] font-semibold text-white transition-colors duration-150 ease-snap hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-muted">
            
            <PlayIcon className="h-4 w-4" aria-hidden="true" />
            판정 시작
          </button>
        </section>
      </div>
    </AppShell>);

}