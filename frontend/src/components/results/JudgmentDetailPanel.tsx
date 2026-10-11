import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, TriangleAlertIcon } from 'lucide-react';
import type { Judgment, JudgmentOriginType, Transaction } from '../../types/domain';
import { api, ApiRequestError, useApi } from '../../api';
import { Badge, Button, ChoiceGroup, Input } from '../ui';
import { VerdictBadge } from '../VerdictBadge';
import { StatuteCitation } from '../StatuteCitation';
import { VERDICT_LABEL } from '../../utils/verdict';
import { formatFullDate, formatWon, ro } from '../../utils/format';

/** 2.8 이 revision 이 생긴 직접 원인 */
const ORIGIN_LABEL: Record<JudgmentOriginType, string> = {
  RUN: '자동 판정',
  USER_FACT: '답변 반영',
  CLASSIFICATION_REVIEW: '분류 확인 반영',
  OVERRIDE: '사용자 수정'
};

/**
 * 확인 필요는 네 갈래다 (docs/rule-card-fields.md). verdict 는 모두 NEEDS_REVIEW 지만
 * 같은 문구로 보이면 ②(넘김)와 ③(남은 조건)이 정반대로 읽혀 사용자가 포기한다.
 * 불가인데 답할 질문이 남았으면 소명 대기다(주말·공휴일 식대 등). 추정일 뿐 확정이 아니다.
 */
type ReviewState = 'QUESTION' | 'HANDOFF' | 'FOLLOW_UP' | 'NO_RULE' | 'PRESUMED';

const REVIEW_MESSAGE: Record<ReviewState, string> = {
  QUESTION: '답할 질문이 남아 있습니다. 답하면 바로 다시 판정합니다.',
  HANDOFF: '판정하지 않고 세무사에게 넘겼습니다. 규칙으로 다루지 않는 지출입니다.',
  // 문서(rule-card-fields.md ③)는 「인정됩니다」라 쓰지만, R-300 혼자작업처럼 조문만으로 갈리지 않는 답도
  // 여기 들어온다. 둘 다에 맞는 말로 쓴다
  FOLLOW_UP:
  '답을 반영했지만 규칙만으로는 아직 확정하지 못했습니다. 안분 비율·기간처럼 뒤에서 정할 조건이 남았거나 세무사 판단이 필요한 답입니다.',
  NO_RULE: '판정할 규칙이 없습니다. 근거를 지어내지 않고 확인 필요로 두었습니다.',
  PRESUMED: '추정으로 제외했어요. 업무였다면 질문에 답해 주세요. 답하면 다시 판정합니다.'
};

/** 사용자가 바꿀 수 있는 판정. 확인 필요로 되돌리는 수정은 받지 않는다 (#62 논의) */
type Target = 'AVAILABLE' | 'UNAVAILABLE';

/** 3.8 reason. 자주 쓰는 사유를 고르고, 필요하면 덧붙여 적는다 */
const REASONS: Record<Target, string[]> = {
  AVAILABLE: ['사업에 직접 사용한 비용입니다', '업무 관련 지출이며 증빙이 있습니다'],
  UNAVAILABLE: ['개인적으로 사용한 비용입니다', '사업과 관련 없는 지출입니다']
};

const toLabel = (code: Target) => `${VERDICT_LABEL[code]}${ro(VERDICT_LABEL[code])}`;

const errorMessage = (caught: unknown, fallback: string) =>
caught instanceof ApiRequestError ? caught.message : fallback;

const attributeValue = (value: unknown) =>
value === true ? '예' : value === false ? '아니오' : String(value);

interface JudgmentDetailPanelProps {
  /** 거래의 현재 판정 */
  judgment: Judgment;
  transaction: Transaction;
  /** 사용자가 행을 고를 때마다 늘어난다. 바뀌면 제목으로 초점을 옮긴다(같은 행을 다시 골라도) */
  focusKey?: number;
  /** 수정·해제로 현재 판정이 바뀌었을 때 */
  onChanged: () => void;
}

export function JudgmentDetailPanel({
  judgment,
  transaction,
  focusKey = 0,
  onChanged
}: JudgmentDetailPanelProps) {
  const [target, setTarget] = useState<Target | null>(null);
  const [preset, setPreset] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  const editHeading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLDivElement>(null);

  // 현재 판정이 바뀌면 이력도 다시 읽는다
  const historyQ = useApi(
    () =>
    api.judgments.list({
      transactionId: judgment.transactionId,
      latestOnly: false,
      size: 20
    }),
    [judgment.transactionId, judgment.id]
  );
  // 확인 필요·불가라면 이 거래에 남은 질문(①, 소명 대기)과 이미 답한 질문(③)이 있는지 본다.
  // ③을 origin 으로 판단하면 다시 판정(Run)한 뒤 origin 이 RUN 으로 바뀌어 안내가 사라진다
  const reviewQ = useApi(
    () =>
    judgment.verdict.code !== 'AVAILABLE' ?
    Promise.all([
    api.questions.list({ transactionId: judgment.transactionId, status: 'PENDING', size: 1 }),
    api.questions.list({ transactionId: judgment.transactionId, status: 'ANSWERED', size: 1 })]
    ).then(([pending, answered]) => ({
      pending: pending.page.totalElements,
      answered: answered.page.totalElements
    })) :
    Promise.resolve(null),
    [judgment.transactionId, judgment.id]
  );

  // 고른 행에 초점이 남아 있을 때만 패널로 옮긴다. 그사이 다른 곳으로 옮겼으면 뺏지 않는다
  useEffect(() => {
    if (focusKey === 0) return;
    const active = document.activeElement;
    if (!active || active === document.body || active.getAttribute('aria-current') === 'true')
    title.current?.focus();
  }, [focusKey]);

  // 폼을 열면 첫 사유로 초점을 옮긴다
  useEffect(() => {
    if (target) form.current?.querySelector<HTMLElement>('button')?.focus();
  }, [target]);

  const overridden = judgment.origin.type === 'OVERRIDE';
  const asset = judgment.attributes['자산'] === true;
  // 질문 조회가 끝나지 않았거나 실패했으면 ①·③을 가를 수 없다. 틀린 안내보다 안내 없음이 낫다
  // 지금 판정의 표지(범위 밖·규칙 없음)가 질문 상태보다 먼저다. 예전 답이 남아 있어도 규칙이 없으면 ④다
  const reviewState: ReviewState | null =
  judgment.verdict.code === 'AVAILABLE' || overridden ?
  null :
  judgment.verdict.code === 'UNAVAILABLE' ?
  reviewQ.data && !reviewQ.loading && !reviewQ.error && reviewQ.data.pending > 0 ? 'PRESUMED' : null :
  judgment.outOfScope ?
  'HANDOFF' :
  judgment.unmatchedReason === 'RULE_NOT_FOUND' || judgment.isInference ?
  'NO_RULE' :
  !reviewQ.data || reviewQ.loading || reviewQ.error ?
  null :
  reviewQ.data.pending > 0 ?
  'QUESTION' :
  reviewQ.data.answered > 0 ?
  'FOLLOW_UP' :
  null;
  // 수정했다면 규칙 엔진이 낸 마지막 판정을 함께 보여준다 (이력은 최신순)
  const engine = overridden ?
  historyQ.data?.items.find((revision) => revision.origin.type !== 'OVERRIDE') :
  undefined;
  const targets: Target[] = (['AVAILABLE', 'UNAVAILABLE'] as const).filter(
    (code) => code !== judgment.verdict.code
  );
  const reason = [preset, note.trim()].filter(Boolean).join(' — ');
  const attributes = Object.entries(judgment.attributes);

  const open = (next: Target) => {
    setTarget(next);
    setPreset('');
    setNote('');
    setError(null);
    setDone('');
  };

  const close = () => {
    setTarget(null);
    editHeading.current?.focus();
  };

  const save = async () => {
    if (!target || !reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.judgments.override(judgment.id, { toVerdict: target, reason });
      setDone(`${toLabel(target)} 바꿨습니다. 이전 판정은 이력에 남아 있습니다.`);
      close();
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught, '판정을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    if (!judgment.origin.id || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.judgments.removeOverride(judgment.origin.id);
      setDone('수정을 되돌렸습니다. 규칙 엔진의 판정을 다시 씁니다.');
      editHeading.current?.focus();
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught, '수정을 되돌리지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={judgment.verdict} size="md" />
          {judgment.outOfScope && <Badge tone="warn">판정 범위 밖</Badge>}
          <Badge>{ORIGIN_LABEL[judgment.origin.type]}</Badge>
          <span className="text-caption tabular-nums text-muted">
            rev.{judgment.revision}
          </span>
        </div>
        <h2
          ref={title}
          tabIndex={-1}
          className="mt-2.5 scroll-mt-24 text-h4 font-bold tracking-tight text-ink outline-none">

          {transaction.merchantNorm}
        </h2>
        <p className="mt-1 text-caption tabular-nums text-muted">
          {formatFullDate(transaction.approvedAt)} · {transaction.merchantRaw}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-px border-b border-line bg-line">
        <div className="bg-surface px-5 py-3">
          <dt className="text-caption text-muted">승인금액</dt>
          <dd className="mt-0.5 text-body-lg font-semibold tabular-nums text-ink">
            {formatWon(transaction.amount)}
          </dd>
        </div>
        <div className="bg-surface px-5 py-3">
          {/* 자산은 그해 넣을 수 있는 한도다. 「넣으세요」가 아니라 「까지 넣을 수 있습니다」 (CONTEXT.md G4) */}
          <dt className="text-caption text-muted">
            {asset ? `${transaction.approvedAt.slice(0, 4)}년에 넣을 수 있는 금액` : '필요경비 산입액'}
          </dt>
          <dd
            className={`mt-0.5 text-body-lg font-semibold tabular-nums ${
            judgment.finalAmount ? 'text-ok' : 'text-muted'}`
            }>

            {judgment.finalAmount !== null ?
            `${formatWon(judgment.finalAmount)}${asset ? '까지' : ''}` :
            '—'}
          </dd>
        </div>
      </dl>

      <section className="border-b border-line px-5 py-4">
        <h3 className="text-small font-semibold text-ink">판정 이유</h3>
        {reviewState &&
        <div className="mt-2 rounded-xl border border-line bg-canvas px-3.5 py-3 text-small text-ink2">
            <p>{REVIEW_MESSAGE[reviewState]}</p>
            {(reviewState === 'QUESTION' || reviewState === 'PRESUMED') &&
          <Link
            to="/questions"
            className="mt-1.5 inline-flex items-center gap-1 font-semibold text-accent hover:underline">

                질문에 답하기
                <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
          }
          </div>
        }
        <p className="mt-2 text-small leading-6 text-ink2">
          {overridden ?
          engine ?
          '직접 수정한 판정입니다. 규칙 엔진의 판정은 아래와 같고, 이력에도 그대로 남아 있습니다.' :
          '직접 수정한 판정입니다. 규칙 엔진이 낸 판정은 이력에 그대로 남아 있습니다.' :
          judgment.explanation ??
          '적용된 규칙 카드에 설명 문구가 없습니다. 근거 조문을 확인해 주세요.'}
        </p>
        {engine &&
        <div className="mt-2 rounded-xl border border-line bg-canvas px-3.5 py-3 text-small text-ink2">
            <p className="flex items-center gap-2 text-caption text-muted">
              규칙 엔진의 판정 <VerdictBadge verdict={engine.verdict} />
            </p>
            <p className="mt-1.5 leading-6">
              {engine.explanation ?? '적용된 규칙 카드에 설명 문구가 없습니다.'}
            </p>
          </div>
        }
        {judgment.blockedAtGate && !overridden &&
        <p className="mt-2 text-caption tabular-nums text-muted">
            막힌 게이트 {judgment.blockedAtGate}
            {judgment.unmatchedReason && ` · 사유 ${judgment.unmatchedReason}`}
          </p>
        }
      </section>

      <section className="border-b border-line px-5 py-4">
        {/* 수정한 판정은 규칙 엔진의 근거를 그대로 들고 있다. 수정의 근거로 읽히지 않게 한다 */}
        <h3 className="text-small font-semibold text-ink">
          {overridden ? '규칙 엔진이 붙인 근거 조문' : '근거 조문'}
        </h3>
        {judgment.citations.length > 0 ?
        <div className="mt-2.5 space-y-2">
            {judgment.citations.map((citation) =>
          <StatuteCitation
            key={citation.statuteVersionId}
            statuteVersionId={citation.statuteVersionId} />

          )}
          </div> :

        judgment.verdict.code === 'NEEDS_REVIEW' && !overridden ?
        <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-warn-line bg-warn-bg p-3.5">
            <TriangleAlertIcon
            className="mt-0.5 h-4 w-4 shrink-0 text-warn"
            aria-hidden="true" />

            <p className="text-small leading-6 text-ink2">
              <strong className="font-semibold text-warn">근거 조문 없음.</strong>{' '}
              조문을 붙일 수 없어 가능·불가로 확정하지 않았습니다. 근거를 지어내지 않고 비워
              두었습니다.
            </p>
          </div> :

        <p className="mt-2 text-small text-muted">붙은 근거 조문이 없습니다.</p>
        }
      </section>

      <section className="border-b border-line bg-canvas px-5 py-3.5">
        <dl className="space-y-1 text-caption tabular-nums text-muted">
          <div className="flex justify-between gap-2">
            <dt>계정과목</dt>
            <dd className="text-ink2">{judgment.account ?? '—'}</dd>
          </div>
          {attributes.map(([key, value]) =>
          <div key={key} className="flex justify-between gap-2">
              <dt>{key}</dt>
              <dd className="text-ink2">{attributeValue(value)}</dd>
            </div>
          )}
          {judgment.ruleCardId &&
          <div className="flex justify-between gap-2">
              <dt>규칙 카드</dt>
              <dd className="text-ink2">
                {judgment.ruleCardId}
                {judgment.ruleCardVersion !== null && ` v${judgment.ruleCardVersion}`}
                {judgment.appliedRuleIds.length > 1 &&
                ` 외 ${judgment.appliedRuleIds.length - 1}장`}
              </dd>
            </div>
          }
          {judgment.rulesCommitSha &&
          <div className="flex justify-between gap-2">
              <dt>규칙 커밋</dt>
              <dd className="text-ink2">{judgment.rulesCommitSha.slice(0, 8)}</dd>
            </div>
          }
          {judgment.userContextVersion !== null &&
          <div className="flex justify-between gap-2">
              <dt>문진 버전</dt>
              <dd className="text-ink2">v{judgment.userContextVersion}</dd>
            </div>
          }
          <div className="flex justify-between gap-2">
            <dt>판정 시각</dt>
            <dd className="text-ink2">{judgment.computedAt.slice(0, 16).replace('T', ' ')}</dd>
          </div>
        </dl>
      </section>

      <section className="border-b border-line px-5 py-4">
        <h3 ref={editHeading} tabIndex={-1} className="text-small font-semibold text-ink outline-none">
          판정이 실제와 다르다면
        </h3>
        <p className="mt-1.5 text-caption text-muted">
          바꾼 기록은 새 판정 이력으로 남고, 이전 판정은 지워지지 않습니다.
        </p>

        {overridden &&
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-canvas px-3.5 py-3">
            <p className="text-small text-ink2">직접 수정한 판정을 쓰고 있습니다.</p>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void release()}>
              수정 되돌리기
            </Button>
          </div>
        }

        {target === null ?
        <div className="mt-3 flex gap-2">
            {targets.map((code) =>
          <Button
            key={code}
            variant="secondary"
            size="sm"
            className="flex-1"
            disabled={busy}
            onClick={() => open(code)}>

                {toLabel(code)} 바꾸기
              </Button>
          )}
          </div> :

        <div ref={form} className="mt-3 space-y-3">
            <p className="text-small font-semibold text-ink">
              {toLabel(target)} 바꾸는 이유
            </p>
            <ChoiceGroup
            name={`${toLabel(target)} 바꾸는 이유`}
            columns={2}
            value={preset}
            onChange={setPreset}
            options={REASONS[target].map((text) => ({ value: text, label: text }))} />

            <Input
            aria-label="사유 직접 적기"
            placeholder="직접 적기 (선택)"
            maxLength={200}
            value={note}
            onChange={(event) => setNote(event.target.value)} />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" disabled={busy} onClick={close}>
                취소
              </Button>
              <Button size="sm" disabled={!reason || busy} onClick={() => void save()}>
                {busy ? '저장 중…' : '저장'}
              </Button>
            </div>
          </div>
        }

        <p role="status" className="mt-2.5 text-caption text-muted empty:mt-0">
          {done}
        </p>
        {error &&
        <p
          role="alert"
          className="mt-3 rounded-xl border border-deny-line bg-deny-bg px-3.5 py-2.5 text-small text-deny">

            {error}
          </p>
        }
      </section>

      <section className="px-5 py-4">
        <h3 className="text-small font-semibold text-ink">판정 이력</h3>
        {historyQ.error ?
        <p className="mt-2 text-caption text-muted">
            이력을 불러오지 못했습니다.{' '}
            <button type="button" onClick={historyQ.reload} className="text-accent hover:underline">
              다시 시도
            </button>
          </p> :

        <ol className="mt-2.5 space-y-2">
            {(historyQ.data?.items ?? []).map((revision) =>
          <li key={revision.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption tabular-nums text-muted">
                <span className="w-10 shrink-0">rev.{revision.revision}</span>
                <VerdictBadge verdict={revision.verdict} />
                <span className="text-ink2">{ORIGIN_LABEL[revision.origin.type]}</span>
                <span>{revision.computedAt.slice(0, 16).replace('T', ' ')}</span>
                {revision.id === judgment.id && <Badge tone="ink">현재</Badge>}
              </li>
          )}
          </ol>
        }
      </section>
    </div>);

}
