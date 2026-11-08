import { useEffect, useRef, useState } from 'react';
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, Loader2Icon, SparklesIcon, UploadIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { StepEyebrow } from '../components/StepEyebrow';
import { api, ApiRequestError, useApi } from '../api';
import { useSession } from '../contexts/SessionContext';
import { Button, Empty, cn } from '../components/ui';
import { MERCHANT_CATEGORIES } from '../types/domain';
import { categoryLabel, merchantName, suggestionReason } from '../components/results/display';
import type { ClassificationReviewGroup } from '../types/domain';
import { uploadName } from '../copy';
import { formatFullDate, formatNumber, formatPeriod, formatWon } from '../utils/format';

/**
 * 직접 고르는 카테고리. PG_미상은 결제대행사라 가맹점을 모른다는 표시지 지출의 종류가 아니라서 뺀다.
 * 가나다순이고 기타는 맨 끝이다. 화면에서만 바꾼다 — 어휘의 원본은 rules/categories.yaml 이다
 */
const PICKABLE_CATEGORIES: string[] = MERCHANT_CATEGORIES.
filter((category) => category !== 'PG_미상').
sort((a, b) => a === '기타' ? 1 : b === '기타' ? -1 : categoryLabel(a).localeCompare(categoryLabel(b), 'ko'));

/** 고르는 칸. 추천도, 다른 카테고리도, 펼치는 칸도 같은 모양이다 */
const CHOICE =
'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-body text-ink transition-colors duration-150 ease-snap hover:bg-surface disabled:cursor-not-allowed';

/** 카드 하나의 저장 상태. saved 는 빠지는 동안이고, 빠지고 나면 gone 이라 그리지 않는다 */
type CardState =
{kind: 'saving';category: string;} |
{kind: 'saved';} |
{kind: 'gone';} |
{kind: 'error';message: string;};

/**
 * 가맹점 분류 확인. 몇 단계인지는 STEPS 가 정한다(components/steps.tsx)
 * 서버가 가맹점을 분류하지 못한 거래를 사용자가 카테고리로 확정한다.
 * 미분류로 남은 거래는 룰엔진에 전달되지 않으므로(api.md 3.3) 판정에서 빠진다는 것을 화면에서 말한다.
 */
export function ClassificationPreview() {
  const { batchId, batchStatus, reloadBatch, contextStatus } = useSession();
  const [cards, setCards] = useState<Record<string, CardState>>({});

  const groupsQ = useApi(
    () =>
    batchId ?
    api.classificationReviews.grouped({ batchId, status: 'PENDING', size: 100 }) :
    Promise.resolve(null),
    [batchId]
  );
  const batchQ = useApi(
    () => batchId ? api.uploads.get(batchId) : Promise.resolve(null),
    [batchId]
  );

  // 보던 업로드가 바뀌면 카드 상태도 처음부터다
  useEffect(() => setCards({}), [batchId]);

  const groups = groupsQ.data?.items ?? [];
  const batch = batchQ.data;

  /**
   * 서버가 주는 미해소 집계. page·size 와 무관하게 배치 전체 기준이다 (api.md 3.5).
   * 그룹 배열을 더하면 지금 페이지만 더하게 되어 그룹이 한 페이지를 넘으면 틀린다.
   */
  const unresolved = groupsQ.data?.unresolved;
  const pendingCount = unresolved?.count ?? 0;
  const pendingAmount = unresolved?.amount ?? null;
  const merchantTotal = groupsQ.data?.page.totalElements ?? 0;

  /** 처음 읽는 중이다. 0건으로 그리지 않고 자리만 보인다. 다시 읽을 때는 앞서 읽은 것을 그대로 둔다 (C61) */
  const waiting =
  batchStatus === 'loading' ||
  (groupsQ.loading && groupsQ.data === null) ||
  (batchQ.loading && batchQ.data === null);
  const loadError = groupsQ.error ?? batchQ.error;
  /** 올린 배치 자체가 없으면 「다 분류했다」가 아니라 「올린 게 없다」다 */
  const noBatch = !batchId || batch === null;

  /** 문진이 이미 있으면 문진을 건너뛴다. 조회 중이거나 실패했으면 판정 전 확인이 다시 막는다 (C2) */
  const toInterview = contextStatus === 'none';
  const nextTo = toInterview ? '/interview' : '/confirm';

  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const setCard = (key: string, state: CardState) =>
  setCards((prev) => ({ ...prev, [key]: state }));

  const resolve = async (group: ClassificationReviewGroup, title: string, category: string) => {
    const key = group.groupKey;
    // 저장하는 동안 다시 누르면 자기 요청이 409(이미 분류)로 돌아온다
    const current = cards[key];
    if (current && current.kind !== 'error') return;
    setCard(key, { kind: 'saving', category });
    try {
      await api.classificationReviews.respond({ reviewIds: group.reviewIds, merchantCategory: category });
    } catch (caught) {
      // 409: 다른 탭·기기에서 이미 분류했다(CLASSIFICATION_ALREADY_RESOLVED). 저장한 것처럼 빼고 다시 읽는다
      if (!(caught instanceof ApiRequestError && caught.status === 409)) {
        // 실패는 그 카드 안에 적는다. 화면 위에 띄우면 보이지 않는다 (C60)
        setCard(key, { kind: 'error', message: `${title} 분류를 저장하지 못했습니다. 다시 눌러 주세요.` });
        return;
      }
    }
    // 저장된 뒤에야 카드를 뺀다. 빠지는 게 보이도록 전환이 끝난 뒤 다시 읽는다
    setCard(key, { kind: 'saved' });
    timers.current.push(window.setTimeout(() => {
      setCard(key, { kind: 'gone' });
      groupsQ.reload();
    }, 280));
  };

  const body = () => {
    if (batchStatus === 'error') {
      return (
        <Empty
          className="mt-8"
          tone="error"
          icon={<UploadIcon className="h-5 w-5" />}
          title="올린 카드내역을 불러오지 못했습니다"
          action={
          <Button size="md" variant="secondary" onClick={reloadBatch}>
              다시 시도
            </Button>
          } />);


    }
    if (waiting) return <Placeholder />;
    if (loadError) {
      return (
        <Empty
          className="mt-8"
          tone="error"
          icon={<UploadIcon className="h-5 w-5" />}
          title="분류 결과를 불러오지 못했습니다"
          action={
          <Button
            size="md"
            variant="secondary"
            onClick={() => {
              groupsQ.reload();
              batchQ.reload();
            }}>

                다시 시도
              </Button>
          } />);


    }
    if (noBatch) {
      return (
        <Empty
          className="mt-8"
          icon={<UploadIcon className="h-5 w-5" />}
          title="올린 카드내역이 없습니다"
          action={
          <Button to="/upload" size="md">
                카드내역 올리기
              </Button>
          } />);


    }
    if (groups.length === 0) {
      // 이 화면에서 다 고른 것이면 고른 만큼 말한다. 처음부터 없던 것과 같은 말을 하면 고른 일이 사라진 듯 읽힌다
      const done = Object.values(cards).filter((card) => card.kind === 'gone' || card.kind === 'saved').length;
      return (
        <Empty
          className="mt-8"
          icon={<CheckIcon className="h-5 w-5" strokeWidth={2.5} />}
          title={done > 0 ? `가맹점 ${formatNumber(done)}곳을 모두 분류했습니다` : '분류할 가맹점이 없습니다'}
          action={
          <Button to={nextTo} size="md">
                {toInterview ? '다음: 사업자 문진' : '다음: 판정 전 확인'}
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
          } />);


    }

    return (
      <>
        <section className="mt-8" aria-labelledby="pending-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="pending-heading" className="text-h4 font-bold text-ink">
              분류 필요 {formatNumber(pendingCount)}건
            </h2>
            {pendingAmount !== null &&
            <p className="whitespace-nowrap text-body font-bold tabular-nums text-ink">
                {formatWon(pendingAmount)}
              </p>
            }
          </div>
          {groups.length < merchantTotal &&
          <p className="mt-1 text-body text-ink2">
              가맹점 {formatNumber(merchantTotal)}곳 가운데 {formatNumber(groups.length)}곳을 먼저 보여 줍니다.
            </p>
          }

          <ul className="mt-4 space-y-3">
            {groups.
            filter((group) => cards[group.groupKey]?.kind !== 'gone').
            map((group) =>
            <ReviewCard
              key={group.groupKey}
              group={group}
              state={cards[group.groupKey]}
              onPick={(title, category) => void resolve(group, title, category)} />

            )}
          </ul>
        </section>

        {/* 건너뛰면 잃는 것을 말한다. 고르지 않은 거래는 판정에 들어가지 않는다 */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <p className="max-w-md text-body text-ink2">
            분류하지 않은{' '}
            <strong className="font-bold text-ink">{formatNumber(pendingCount)}건</strong>은 판정에서 빠집니다.
          </p>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="secondary" size="md" className="whitespace-nowrap" to="/upload">
              다시 올리기
            </Button>
            <Button variant="secondary" size="md" className="whitespace-nowrap" to={nextTo}>
              {toInterview ? '건너뛰고 사업자 문진으로' : '건너뛰고 판정 전 확인으로'}
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </>);

  };

  return (
    <AppShell narrow>
      <div className="max-w-3xl">
        <header>
          <StepEyebrow />
          <h1 className="mt-1.5 text-h2 font-bold tracking-tight text-ink">분류 확인</h1>
          {/* 어느 업로드를 보고 있는지 (C54). 업로드 이력·판정 전 확인과 같은 이름을 쓴다 */}
          {batch &&
          <p className="mt-2 flex flex-wrap gap-x-3 text-body text-ink2">
              <span className="font-bold text-ink">{uploadName(batch)}</span>
              <span className="tabular-nums">{formatPeriod(batch.periodStart, batch.periodEnd)}</span>
            </p>
          }
        </header>
        {body()}
      </div>
    </AppShell>);

}

/** 처음 읽는 동안의 자리. 숫자와 버튼을 그리지 않는다 (C61) */
function Placeholder() {
  return (
    <div aria-busy="true" className="mt-8">
      <span className="sr-only">분류할 가맹점을 불러오는 중입니다</span>
      <span className="block h-6 w-40 animate-pulse rounded bg-line2 motion-reduce:animate-none" />
      <div className="mt-4 space-y-3">
        {[0, 1].map((index) =>
        <div key={index} className="rounded-2xl border border-line p-6">
            <span className="block h-5 w-1/2 animate-pulse rounded bg-line2 motion-reduce:animate-none" />
            <span className="mt-6 block h-10 w-3/4 animate-pulse rounded-full bg-line2 motion-reduce:animate-none" />
          </div>
        )}
      </div>
    </div>);

}

function Choice({
  suggestion,
  saving,
  disabled,
  onClick,
  children






}: {suggestion: boolean;saving: boolean;disabled: boolean;onClick: () => void;children: React.ReactNode;}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        CHOICE,
        suggestion ? 'border-accent' : 'border-edge',
        // 저장 중인 칸은 고른 칸이라 흐리게 하지 않는다
        saving ? 'bg-accent-soft' : 'bg-canvas disabled:opacity-40'
      )}>

      {saving ?
      <Loader2Icon className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> :
      suggestion && <SparklesIcon className="h-3.5 w-3.5 text-accent" aria-hidden="true" />}
      {children}
      {/* AI 가 고른 첫 후보라는 표시. 판정이 아니라 분류 후보다 (DESIGN.md 말투 규칙) */}
      {suggestion && <span className="text-caption font-bold text-accent">추천</span>}
      {saving && <span className="sr-only">저장하는 중</span>}
    </button>);

}

/**
 * 가맹점 하나. 이름과 금액, 묻는 말, 그리고 같은 모양의 선택지 한 줄이다 (U6, C74).
 * 모델의 첫 후보는 파란 테두리와 「추천」으로 표시하고, 나머지 카테고리는 같은 모양으로 펼친다
 */
function ReviewCard({
  group,
  state,
  onPick




}: {group: ClassificationReviewGroup;state: CardState | undefined;onPick: (title: string, category: string) => void;}) {
  const [expanded, setExpanded] = useState(false);
  // 승인일 오름차순으로 이미 정렬돼 온다 (api.md 3.5)
  const rows = group.transactions;
  // 한 가맹점이 카드사에서 여러 표기로 찍힌 경우 제목은 정규화된 이름을 쓴다.
  // groupKey 는 형식을 보장하지 않으므로 파싱하지 않고 merchantNorm 을 쓴다.
  const rawVariants = new Set(rows.map((row) => row.merchantRaw)).size;
  const title = rawVariants > 1 ? group.merchantNorm : merchantName(group.merchantRaw);

  const suggested = group.suggestedCategories;
  const others = PICKABLE_CATEGORIES.filter((category) => !suggested.includes(category));
  // 모델 후보가 없으면 펼칠 것 없이 처음부터 다 보인다
  const open = expanded || suggested.length === 0;
  const busy = state?.kind === 'saving' || state?.kind === 'saved';

  const choice = (category: string, suggestion: boolean) =>
  <Choice
    key={category}
    suggestion={suggestion}
    saving={state?.kind === 'saving' && state.category === category}
    disabled={busy}
    onClick={() => onPick(title, category)}>

      {categoryLabel(category)}
    </Choice>;


  return (
    <li
      aria-busy={state?.kind === 'saving' || undefined}
      className={cn(
        'rounded-2xl border border-line bg-canvas p-6 transition-all duration-300 ease-snap',
        state?.kind === 'saved' && 'scale-[0.98] opacity-0'
      )}>

      <div className="flex items-baseline justify-between gap-4">
        <p className="min-w-0 truncate text-body-lg font-bold text-ink" title={title}>
          {title}
        </p>
        <p className="shrink-0 whitespace-nowrap text-body-lg font-bold tabular-nums text-ink">
          {formatWon(group.totalAmount)}
        </p>
      </div>

      {/*
        건별 목록은 접어 둔다. 그룹 카드가 여러 장 쌓이는데 카드마다 거래가 네 줄씩
        붙어 있어 「어떤 지출인가요?」까지 내려가기도 전에 화면이 찬다 (#242 리뷰).
        고르는 일은 늘 보이고, 떠올릴 거리만 열어서 본다. 한 건이면 펼칠 것 없이 날짜만 보인다
      */}
      {group.count === 1 && rows.length === 1 ?
      <p className="mt-1 text-small tabular-nums text-ink2">
          {formatFullDate(rows[0].approvedAt)}
          {rows[0].installmentMonths > 0 && `, ${rows[0].installmentMonths}개월 할부`}
        </p> :

      <details className="mt-1">
        <summary className="cursor-pointer text-small text-ink2 hover:text-ink">
          건별 보기 ({formatNumber(group.count)}건)
        </summary>
        <ul className="mt-2 divide-y divide-line2">
          {rows.slice(0, 4).map((row) => {
            // 그룹 제목과 같은 표기면 반복하지 않는다
            const detail = [
            merchantName(row.merchantRaw) === title ? '' : merchantName(row.merchantRaw),
            row.installmentMonths > 0 ? `${row.installmentMonths}개월 할부` : ''].
            filter(Boolean).join(', ');
            return (
              <li key={row.transactionId} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="w-24 shrink-0 whitespace-nowrap text-small tabular-nums text-ink2">
                  {formatFullDate(row.approvedAt)}
                </span>
                <span className="min-w-0 flex-1 truncate text-small text-ink2">{detail}</span>
                <span className="shrink-0 whitespace-nowrap text-small font-bold tabular-nums text-ink">
                  {formatWon(row.amount)}
                </span>
              </li>);

          })}
          {group.count > 4 &&
          <li className="py-2 text-small text-ink2">외 {formatNumber(group.count - 4)}건</li>
          }
        </ul>
      </details>
      }

      <p className="mt-5 text-body font-bold text-ink">
        {group.count > 1 ? `이 ${formatNumber(group.count)}건은 어떤 지출인가요?` : '어떤 지출인가요?'}
      </p>
      {/* 추천의 근거(11/8 회의). 모델은 가맹점 이름만 받는다. 이유 문장은 주지 않아 지어내지 않는다 */}
      <p className="mt-1 text-small text-ink2">{suggestionReason(suggested[0])}</p>
      {suggested.length > 0 &&
      <div role="group" aria-label={`${title} 카테고리`} className="mt-3 flex flex-wrap gap-2">
          {suggested.map((category, index) => choice(category, index === 0))}
          <button
          type="button"
          aria-expanded={open}
          disabled={busy}
          onClick={() => setExpanded((value) => !value)}
          className={cn(CHOICE, 'border-edge bg-canvas disabled:opacity-40')}>

            다른 카테고리
            <ChevronDownIcon
            className={cn('h-4 w-4 transition-transform duration-150', open && 'rotate-180')}
            aria-hidden="true" />

          </button>
        </div>
      }
      {open &&
      <div
        role="group"
        aria-label={suggested.length > 0 ? `${title} 다른 카테고리` : `${title} 카테고리`}
        className="mt-3 flex flex-wrap gap-2">

          {others.map((category) => choice(category, false))}
        </div>
      }
      {state?.kind === 'error' &&
      <p role="alert" className="mt-3 text-body text-deny">
          {state.message}
        </p>
      }
    </li>);

}
