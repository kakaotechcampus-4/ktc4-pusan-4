import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, SparklesIcon, UploadIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { api, ApiRequestError, useApi } from '../api';
import { useSession } from '../contexts/SessionContext';
import { Badge, Button, Card, Empty, Select } from '../components/ui';
import { MERCHANT_CATEGORIES } from '../types/domain';
import { formatFullDate, formatNumber, formatWon } from '../utils/format';

/**
 * 2단계 · 분류 확인.
 * 서버가 가맹점을 분류하지 못한 거래를 사용자가 카테고리로 확정한다.
 * 미분류로 남은 거래는 룰엔진에 전달되지 않으므로(api.md 3.3) 판정에서 빠진다는 것을 화면에서 말한다.
 */
export function ClassificationPreview() {
  const navigate = useNavigate();
  const { batchId } = useSession();
  const [resolving, setResolving] = useState<Record<string, true>>({});

  const groupsQ = useApi(
    () =>
    api.classificationReviews.grouped({
      batchId: batchId ?? undefined,
      status: 'PENDING',
      size: 100
    }),
    [batchId]
  );
  const batchQ = useApi(
    () => batchId ? api.uploads.get(batchId) : Promise.resolve(null),
    [batchId]
  );
  // 그룹 응답에는 건별 정보가 없어(api.md 3.5) 개별 리뷰와 거래를 함께 읽는다
  const reviewsQ = useApi(
    () =>
    api.classificationReviews.list({
      batchId: batchId ?? undefined,
      status: 'PENDING',
      size: 100
    }),
    [batchId]
  );
  const txQ = useApi(
    () =>
    api.transactions.list({
      batchId: batchId ?? undefined,
      classificationStatus: 'NEEDS_REVIEW',
      size: 100
    }),
    [batchId]
  );

  const txById = new Map((txQ.data?.items ?? []).map((t) => [t.id, t]));
  const reviewById = new Map((reviewsQ.data?.items ?? []).map((r) => [r.id, r]));

  /**
   * 그룹에 묶인 리뷰. `reviewIds` 로만 찾는다 —
   * merchantNorm 으로 맞추면 같은 가게가 카드사 트랙에 따라 다른 그룹으로 갈릴 때 섞인다.
   */
  const reviewsOf = (group: { reviewIds: string[] }) =>
  group.reviewIds.
  map((id) => reviewById.get(id)).
  filter((r): r is NonNullable<typeof r> => Boolean(r));

  /** 그룹에 묶인 거래 (승인일 오름차순) */
  const rowsOf = (group: { reviewIds: string[] }) =>
  reviewsOf(group).
  map((review) => txById.get(review.transactionId)).
  filter((t): t is NonNullable<typeof t> => Boolean(t)).
  sort((a, b) => a.approvedAt.localeCompare(b.approvedAt));

  const groups = groupsQ.data?.items ?? [];
  const batch = batchQ.data;
  const total = batch?.transactionCount ?? 0;

  /**
   * 건수는 개별 리뷰 응답의 `page.totalElements` 를 쓴다 — 그룹 배열을 더하면
   * 지금 페이지만 더하게 되어 그룹이 한 페이지를 넘으면 틀린다.
   * (#74 가 머지되면 `unresolved{count,amount}` 로 바꾼다)
   */
  const pendingCount = reviewsQ.data?.page.totalElements ?? 0;
  const reviewsComplete =
  reviewsQ.data !== null &&
  reviewsQ.data.items.length === reviewsQ.data.page.totalElements;
  const groupsComplete =
  groupsQ.data !== null &&
  groupsQ.data.items.length === groupsQ.data.page.totalElements;
  /** 금액은 받은 거래로만 더할 수 있다. 다 못 받았으면 숫자를 말하지 않는다 */
  const pendingAmount = reviewsComplete ?
  groups.reduce((sum, group) => sum + group.totalAmount, 0) :
  null;
  const classified = Math.max(0, total - pendingCount);
  const coverage = total ? classified / total * 100 : 100;

  const loading = groupsQ.loading || batchQ.loading || reviewsQ.loading;
  const loadError = groupsQ.error ?? reviewsQ.error ?? txQ.error ?? batchQ.error;
  /** 다 읽고 나서 0건일 때만 「다 분류했다」다 */
  const done = !loading && !loadError && groups.length === 0;
  /** 올린 배치 자체가 없으면 「다 분류했다」가 아니라 「올린 게 없다」다 */
  const noBatch = !batchId || (!batchQ.loading && !batchQ.error && batch === null);

  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const [resolveError, setResolveError] = useState<string | null>(null);

  const resolve = async (groupKey: string, reviewIds: string[], category: string) => {
    setResolving((prev) => ({ ...prev, [groupKey]: true }));
    setResolveError(null);
    try {
      await api.classificationReviews.respond({ reviewIds, merchantCategory: category });
    } catch (caught) {
      setResolveError(
        caught instanceof ApiRequestError ?
        caught.message :
        '업종을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
      setResolving((prev) => {
        const next = { ...prev };
        delete next[groupKey];
        return next;
      });
      return;
    }
    // 카드가 빠지는 게 보이도록 전환이 끝난 뒤 다시 읽는다
    timers.current.push(window.setTimeout(() => {
      groupsQ.reload();
      batchQ.reload();
      reviewsQ.reload();
      txQ.reload();
      setResolving((prev) => {
        const next = { ...prev };
        delete next[groupKey];
        return next;
      });
    }, 280));
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <header>
          <p className="text-small font-semibold text-accent">2단계 · 분류 확인</p>
          <h1 className="mt-1.5 text-h2 font-bold tracking-tight text-ink">
            {loadError ?
            '분류 결과를 불러오지 못했습니다' :
            noBatch ?
            '올린 카드내역이 없습니다' :
            done ?
            '모든 거래를 분류했습니다' :
            '읽지 못한 가맹점만 확인합니다'}
          </h1>
          <p className="mt-2 max-w-2xl text-body leading-6 text-ink2">
            {loadError ?
            '잠시 후 다시 시도해 주세요. 네트워크나 서버 상태를 확인해 주세요.' :
            noBatch ?
            '카드내역을 먼저 올리면 분류 결과를 여기서 확인할 수 있습니다.' :
            done ?
            '모든 거래에 업종이 붙었습니다. 판정은 이제 규칙이 순서대로 실행하며 내립니다.' :
            '가맹점 이름을 업종으로 바꾸는 일까지는 AI가 합니다. 확신이 없는 건만 남겨 두었으니 여기서 골라 주세요. 판정은 그다음에 규칙이 합니다.'}
          </p>
        </header>

        {resolveError &&
        <p
          role="alert"
          className="mt-4 rounded-xl border border-deny-line bg-deny-bg px-4 py-3 text-body text-deny">

            {resolveError}
          </p>
        }

        {loadError ?
        <Empty
          className="mt-8"
          icon={<UploadIcon className="h-5 w-5" />}
          title="분류 결과를 불러오지 못했습니다"
          description="잠시 후 다시 시도해 주세요."
          action={
          <Button
            size="md"
            variant="secondary"
            onClick={() => {
              groupsQ.reload();
              reviewsQ.reload();
              txQ.reload();
              batchQ.reload();
            }}>

                다시 시도
              </Button>
          } /> :

        noBatch ?
        <Empty
          className="mt-8"
          icon={<UploadIcon className="h-5 w-5" />}
          title="아직 올린 카드내역이 없습니다"
          description="국민·기업카드 이용내역을 올리면 분류 결과를 여기서 확인합니다."
          action={
          <Button to="/upload" size="md">
                카드내역 올리기
              </Button>
          } /> :

        <>
        {/* 분류 진척 */}
        <Card tone="canvas" padding="md" className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-small text-muted">분류를 마친 거래</p>
              <p className="mt-1 text-stat font-bold tabular-nums text-ink">
                {formatNumber(classified)}
                <span className="ml-1 text-h4 font-semibold text-muted">
                  / {formatNumber(total)}건
                </span>
              </p>
            </div>
            {done ?
            <Badge tone="ok" symbol="✓">
                분류 완료
              </Badge> :

            <p className="text-small tabular-nums text-warn">
                확인 필요 {formatNumber(pendingCount)}건
                {pendingAmount !== null && ` · ${formatWon(pendingAmount)}`}
              </p>
            }
          </div>

          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-line2"
            role="progressbar"
            aria-valuenow={Math.round(coverage)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="가맹점 분류 진척">

            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500 ease-snap"
              style={{ width: `${coverage}%` }} />

          </div>
        </Card>

        {/* 확인 필요 목록 */}
        <section className="mt-8">
          {!done &&
          <h2 className="text-h4 font-bold text-ink">
              확인이 필요한 가맹점{' '}
              {formatNumber(groupsQ.data?.page.totalElements ?? groups.length)}곳
              {!groupsComplete && ` (${formatNumber(groups.length)}곳 표시)`}
            </h2>
          }

          {done ?
          <Empty
            tone="ok"
            icon={<CheckIcon className="h-5 w-5" strokeWidth={2.5} />}
            title="확인할 가맹점이 없습니다"
            description="모든 거래에 업종이 붙었습니다. 이제 사업자 문진을 마치면 판정을 시작할 수 있습니다."
            action={
            <Button to="/interview" size="md">
                  사업자 문진으로
                  <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
            } /> :


          <ul className="mt-4 space-y-3">
              {groups.map((group) => {
              const rows = rowsOf(group);
              // 한 가맹점이 카드사에서 여러 표기로 찍힌 경우 제목은 정규화된 이름을 쓴다.
              // groupKey 문자열 형식은 계약이 보장하지 않으므로 리뷰의 merchantNorm 을 읽는다.
              const rawVariants = new Set(rows.map((row) => row.merchantRaw)).size;
              const merchantNorm = reviewsOf(group)[0]?.merchantNorm;
              const title =
              rawVariants > 1 && merchantNorm ? merchantNorm : group.merchantRaw;
              return (
                <Card
              key={group.groupKey}
              as="li"
              padding="md"
              className={`border-l-[3px] border-l-warn transition-all duration-300 ease-snap hover:shadow-card ${
              resolving[group.groupKey] ?
              'scale-[0.98] opacity-0' :
              'opacity-100'}`
              }>

                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-body-lg font-semibold text-ink">
                      {title}
                    </p>
                    <p className="text-small tabular-nums text-muted">
                      {formatNumber(group.count)}건 · {formatWon(group.totalAmount)}
                    </p>
                  </div>
                  <p className="mt-1 text-small text-muted">
                    {rawVariants > 1 ?
                    `카드사에 ${formatNumber(rawVariants)}가지 표기로 찍혔습니다. 업종을 읽지 못했습니다` :
                    '카드사에 찍힌 표기 그대로입니다. 이것만으로는 업종을 읽지 못했습니다'}
                  </p>

                  {/* 어떤 결제였는지 떠올릴 수 있도록 건별로 보여준다 */}
                  <ul className="mt-4 divide-y divide-line2 rounded-xl border border-line2 bg-canvas">
                    {rows.slice(0, 4).map((row) =>
                <li
                  key={row.id}
                  className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
                  
                        <span className="w-24 shrink-0 text-small tabular-nums text-ink2">
                          {formatFullDate(row.approvedAt)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-small text-muted">
                          {/* 그룹 제목과 같은 표기면 반복하지 않는다 */}
                          {row.merchantRaw === title ? '' : row.merchantRaw}
                          {row.installmentMonths > 0 &&
                    `${row.merchantRaw === title ? '' : ' · '}${row.installmentMonths}개월 할부`}
                        </span>
                        <span className="shrink-0 text-small font-semibold tabular-nums text-ink">
                          {formatWon(row.amount)}
                        </span>
                      </li>
                )}
                    {group.count > 4 &&
                <li className="px-3.5 py-2 text-caption text-muted">
                        외 {formatNumber(group.count - 4)}건
                      </li>
                }
                  </ul>

                  <p className="mt-5 text-body font-semibold text-ink">
                    이 {formatNumber(group.count)}건은 어떤 지출인가요?
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {group.suggestedCategories.map((category, index) =>
                <Button
                  key={category}
                  variant={index === 0 ? 'soft' : 'secondary'}
                  size="sm"
                  onClick={() =>
                  void resolve(group.groupKey, group.reviewIds, category)
                  }>

                        {index === 0 &&
                  <SparklesIcon
                    className="h-3.5 w-3.5"
                    aria-hidden="true" />
                  }
                        {category}
                      </Button>
                )}

                    <div className="w-44">
                      <Select
                    aria-label={`${title} 카테고리 직접 선택`}
                    defaultValue=""
                    onChange={(event) => {
                      if (!event.target.value) return;
                      void resolve(
                        group.groupKey,
                        group.reviewIds,
                        event.target.value
                      );
                    }}>

                        <option value="">다른 카테고리…</option>
                        {MERCHANT_CATEGORIES.map((category) =>
                    <option key={category} value={category}>
                            {category}
                          </option>
                    )}
                      </Select>
                    </div>
                  </div>
                </Card>);

            })}
            </ul>
          }
        </section>

        {/* 다음 단계 */}
        {!done &&
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
            <p className="max-w-md text-small leading-6 text-muted">
              지금 넘어가면 확인하지 않은{' '}
              <strong className="font-semibold text-ink">
                {formatNumber(pendingCount)}건
              </strong>
              은 판정에서 빠집니다. 나중에 이 화면에서 다시 확인할 수 있습니다.
            </p>
            <div className="flex items-center gap-3">
              <Button
              variant="ghost"
              size="inline"
              onClick={() => navigate('/interview')}>

                건너뛰고 문진으로
              </Button>
              <Button variant="secondary" size="md" to="/upload">
                업로드 다시
              </Button>
            </div>
          </div>
        }
        </>
        }
      </div>
    </AppShell>);

}
