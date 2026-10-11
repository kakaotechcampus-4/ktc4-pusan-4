import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckIcon, PlayIcon, ShieldCheckIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useSession } from '../contexts/SessionContext';
import { api, ApiRequestError, useApi } from '../api';
import { formatFullDate, formatNumber, formatPeriod } from '../utils/format';

export function Confirm() {
  const navigate = useNavigate();
  const { batchId, context, contextRef, setRunId } = useSession();
  // 업로드 이력에서 고르고 들어올 수도 있으므로 세션의 파싱 결과가 아니라 서버에서 읽는다
  const batchQ = useApi(
    () => batchId ? api.uploads.get(batchId) : Promise.resolve(null),
    [batchId]
  );
  const batch = batchQ.data;
  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** POST /judgment-runs — batchId·contextId 둘 다 있어야 실행할 수 있다 */
  const missing = !batchId ?
  '올린 카드내역이 없습니다. 파일을 먼저 올려 주세요.' :
  !contextRef ?
  '사업자 문진을 먼저 마쳐 주세요.' :
  null;

  const start = async () => {
    if (!batchId || !contextRef) return;
    setStarting(true);
    setError(null);
    try {
      const created = await api.runs.create({ batchId, contextId: contextRef.id });
      setRunId(created.id);
      navigate('/run');
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError ?
        caught.message :
        '판정을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setStarting(false);
    }
  };

  // 올린 내역이 없으면 비워 둔다. 없는 파일 이름과 건수를 지어내지 않는다
  const batchRows = batch ?
  [
  { term: '카드사', value: `${batch.cardIssuer}카드 · ${batch.sourceType}` },
  {
    term: '거래',
    value: `${formatNumber(batch.transactionCount)}건${
    batch.skippedDuplicateCount > 0 ?
    ` (중복 ${formatNumber(batch.skippedDuplicateCount)}건 제외 후)` :
    ''}`
  },
  { term: '기간', value: formatPeriod(batch.periodStart, batch.periodEnd) }] :
  [];


  const contextRows = context ?
  [
  { term: '업종', value: `${context.industryCode} · 컴퓨터 프로그래밍` },
  {
    term: '직전연도 수입금액',
    value: `${formatNumber(context.prevYearRevenue)}원`
  },
  { term: '개업일', value: formatFullDate(context.businessOpenDate) },
  { term: '기장의무', value: context.bookkeepingDuty },
  { term: '직원', value: context.hasEmployee ? '있음' : '없음 (1인)' },
  {
    term: '자택 작업 비율',
    value:
    context.homeOfficeRatio > 0 ?
    `${context.homeOfficeRatio}%` :
    '해당 없음'
  }] :
  [];


  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <header>
          <p className="text-small font-semibold text-accent">사람 게이트 ①</p>
          <h1 className="mt-1.5 text-h2 font-bold tracking-tight text-ink">
            이 입력으로 판정합니다
          </h1>
          <p className="mt-2 text-body leading-6 text-ink2">
            판정은 입력을 바꾸지 않으면 항상 같은 결과를 냅니다. 시작 전에 두 입력이
            맞는지만 확인해 주세요.
          </p>
        </header>

        <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3.5 text-body font-semibold text-ink">
            카드내역
          </h2>
          <dl className="divide-y divide-line2">
            {batchRows.length === 0 &&
            <div className="px-5 py-3">
                <p className="text-small text-muted">
                  {batchQ.loading ? '불러오는 중…' : '아직 올린 카드내역이 없습니다.'}
                </p>
              </div>
            }
            {batchRows.map((row) =>
            <div key={row.term} className="flex gap-4 px-5 py-3">
                <dt className="w-36 shrink-0 text-small text-muted">
                  {row.term}
                </dt>
                <dd className="text-small font-medium text-ink">{row.value}</dd>
              </div>
            )}
          </dl>
          <div className="border-t border-line bg-canvas px-5 py-3">
            <Link
              to="/upload"
              className="text-small font-semibold text-accent transition-colors duration-150 hover:text-accent-hover">
              
              카드내역 다시 올리기
            </Link>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3.5 text-body font-semibold text-ink">
            사업자 문진{contextRef && ` · 버전 ${contextRef.version}`}
          </h2>
          <dl className="divide-y divide-line2">
            {contextRows.length === 0 &&
            <div className="px-5 py-3">
                <p className="text-small text-muted">아직 문진을 마치지 않았습니다.</p>
              </div>
            }
            {contextRows.map((row) =>
            <div key={row.term} className="flex gap-4 px-5 py-3">
                <dt className="w-36 shrink-0 text-small text-muted">
                  {row.term}
                </dt>
                <dd className="text-small font-medium tabular-nums text-ink">
                  {row.value}
                </dd>
              </div>
            )}
          </dl>
          <div className="border-t border-line bg-canvas px-5 py-3">
            <Link
              to="/interview"
              className="text-small font-semibold text-accent transition-colors duration-150 hover:text-accent-hover">
              
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
              <h2 className="text-body font-semibold text-ink">
                되돌릴 수 없는 동작은 없습니다
              </h2>
              <p className="mt-1.5 text-small leading-6 text-muted">
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
            
            <span className="text-small leading-6 text-ink2">
              이 결과가 세무 신고를 확정하는 것이 아니며, 최종 판단에는 세무대리인의
              확인이 필요하다는 점을 이해했습니다.
            </span>
          </label>

          {missing &&
          <p
            role="alert"
            className="mt-4 rounded-xl border border-warn-line bg-warn-bg px-4 py-3 text-small leading-6 text-warn">
            
              {missing}{' '}
              <Link
                to={!batchId ? '/upload' : '/interview'}
                className="font-semibold underline">

                {!batchId ? '카드내역 올리기' : '문진 하러 가기'}
              </Link>
            </p>
          }

          {error &&
          <p
            role="alert"
            className="mt-4 rounded-xl border border-deny-line bg-deny-bg px-4 py-3 text-small leading-6 text-deny">

              {error}
            </p>
          }

          <button
            type="button"
            disabled={!agreed || starting || missing !== null}
            onClick={() => void start()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-body-lg font-semibold text-white transition-colors duration-150 ease-snap hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-muted">
            
            <PlayIcon className="h-4 w-4" aria-hidden="true" />
            {starting ? '판정을 시작하는 중…' : '판정 시작'}
          </button>
        </section>
      </div>
    </AppShell>);

}