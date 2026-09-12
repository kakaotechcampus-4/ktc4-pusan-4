import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CopyIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useSession } from '../contexts/SessionContext';
import { BATCH_SUMMARY } from '../mock/judgments';
import { formatNumber, formatWon } from '../utils/format';

const LIMIT_BUCKETS = [
{
  code: '접대비',
  tagged: 3_200_000,
  allowed: 2_500_000,
  state: '잠정',
  basis: '직전연도 수입금액 기준 잠정 한도. 연말 소득 확정 후 재계산합니다.'
},
{
  code: '기부금',
  tagged: 900_000,
  allowed: 900_000,
  state: '잠정',
  basis: '소득금액 확정 전이라 전액 잠정 인정 상태입니다.'
}];


const DEPRECIATION = [
{ year: 2026, limit: 640_166, claimed: 640_166, state: '잠정' },
{ year: 2027, limit: 698_000, claimed: 0, state: '예정' },
{ year: 2028, limit: 698_000, claimed: 0, state: '예정' },
{ year: 2029, limit: 698_000, claimed: 0, state: '예정' },
{ year: 2030, limit: 755_834, claimed: 0, state: '예정' }];


export function Summary() {
  const { counts, recognizedAmount, pendingQuestionCount } = useSession();
  const total = counts.possible + counts.needsReview + counts.impossible;

  const distribution = [
  { label: '가능', value: counts.possible, bar: 'bg-ok' },
  { label: '확인 필요', value: counts.needsReview, bar: 'bg-warn' },
  { label: '불가', value: counts.impossible, bar: 'bg-deny' }];


  return (
    <AppShell>
      <header>
        <p className="text-[13px] font-semibold text-accent">4단계 · 반영</p>
        <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-ink">
          2026년 1월 요약
        </h1>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-surface p-6">
          <p className="text-[13px] text-muted">현재까지 인정된 필요경비</p>
          <p className="mt-1.5 text-[40px] font-bold leading-none tabular-nums text-ink">
            {formatWon(recognizedAmount)}
          </p>
          <p className="mt-2 text-[13px] tabular-nums text-muted">
            확인 필요 {formatNumber(counts.needsReview)}건(
            {formatWon(BATCH_SUMMARY.needsReviewAmount)})은 아직 합계에 넣지
            않았습니다.
          </p>

          <div className="mt-6" aria-hidden="true">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-line2">
              {distribution.map((item) =>
              <div
                key={item.label}
                className={item.bar}
                style={{ width: `${item.value / total * 100}%` }} />

              )}
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-4">
            {distribution.map((item) =>
            <div key={item.label}>
                <dt className="flex items-center gap-1.5 text-[12px] text-muted">
                  <span
                  className={`h-2 w-2 rounded-full ${item.bar}`}
                  aria-hidden="true" />
                
                  {item.label}
                </dt>
                <dd className="mt-1 text-[18px] font-semibold tabular-nums text-ink">
                  {formatNumber(item.value)}건
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold text-ink">한도 잔량</h2>
          <ul className="mt-4 space-y-5">
            {LIMIT_BUCKETS.map((bucket) => {
              const usage = Math.min(100, bucket.tagged / bucket.allowed * 100);
              const over = bucket.tagged > bucket.allowed;
              return (
                <li key={bucket.code}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink">
                      {bucket.code}
                    </span>
                    <span className="text-[12px] tabular-nums text-muted">
                      {formatWon(bucket.tagged)} / {formatWon(bucket.allowed)}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-line2"
                    role="progressbar"
                    aria-valuenow={Math.round(usage)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${bucket.code} 한도 사용률`}>
                    
                    <div
                      className={`h-full rounded-full ${over ? 'bg-deny' : 'bg-accent'}`}
                      style={{ width: `${usage}%` }} />
                    
                  </div>
                  <p className="mt-1.5 text-[12px] leading-5 text-muted">
                    {over ?
                    `한도 초과 ${formatWon(bucket.tagged - bucket.allowed)} · ${bucket.basis}` :
                    bucket.basis}
                  </p>
                </li>);

            })}
          </ul>
        </section>
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">
            감가상각 스케줄 · MacBook Pro
          </h2>
          <p className="text-[12px] tabular-nums text-muted">
            취득 3,490,000원 · 내용연수 5년 · 정액법
          </p>
        </header>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line2 text-left text-[12px] text-muted">
              <th scope="col" className="px-5 py-2.5 font-medium">
                귀속연도
              </th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">
                상각범위액
              </th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">
                산입 예정액
              </th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">
                상태
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line2">
            {DEPRECIATION.map((row) =>
            <tr key={row.year}>
                <th
                scope="row"
                className="px-5 py-3 text-left font-medium tabular-nums text-ink">
                
                  {row.year}
                </th>
                <td className="px-5 py-3 text-right tabular-nums text-ink2">
                  {formatWon(row.limit)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-ink2">
                  {row.claimed > 0 ? formatWon(row.claimed) : '—'}
                </td>
                <td className="px-5 py-3 text-right text-muted">{row.state}</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="border-t border-line bg-canvas px-5 py-3 text-[12px] leading-5 text-muted">
          소득이 적은 해에는 상각범위액보다 적게 넣을 수 있습니다. 산입액은 연말에
          확정합니다.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold text-ink">
          세무대리인에게 넘길 문장
        </h2>
        <p className="mt-1.5 text-[13px] text-muted">
          판정하지 않고 남긴 건을 상담용 문장으로 정리했습니다.
        </p>
        <blockquote className="mt-4 rounded-xl bg-canvas p-4 text-[13px] leading-6 text-ink2">
          2026년 1월 사업용카드 292건 중 {formatNumber(counts.needsReview)}건은 근거를
          확정하지 못했습니다. 주요 항목은 단독 카페 이용{' '}
          {pendingQuestionCount > 0 ? '(용도 확인 필요)' : '(사용자 응답 반영)'},
          통신비·자택 관리비 안분율, 연간 구독의 서비스 기간입니다. 자택 작업공간
          면적 비율은 20%로 응답했으며 사업용 차량은 없습니다.
        </blockquote>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors duration-150 ease-snap hover:bg-line2">
            
            <CopyIcon className="h-4 w-4" aria-hidden="true" />
            문장 복사
          </button>
          <Link
            to="/results"
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors duration-150 ease-snap hover:bg-line2">
            
            판정 목록 다시 보기
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </AppShell>);

}