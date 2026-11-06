import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { StepEyebrow } from '../components/StepEyebrow';
import { useSession } from '../contexts/SessionContext';
import { api, ApiRequestError } from '../api';
import type { BookkeepingDuty } from '../types/domain';
import { Button, ChoiceGroup, type ChoiceOption } from '../components/ui';
import { formatNumber } from '../utils/format';
import {
  FIELD_ORDER,
  JUDGED_INDUSTRY,
  checkForm,
  dutyFor,
  formFrom,
  revenueDigits,
  sameContext,
  sameForm,
  saveDraft,
  savedDraft,
  withRevenue,
  type HomeAnswer,
  type InterviewForm } from
'./interviewForm';

/**
 * 서비스는 프리랜서·인적용역(940909)만 동작한다. 다른 직종은 보이되 선택되지 않는다 —
 * 있지만 안 되는 선택지는 '준비 중'으로 표기한다 (DESIGN.md).
 */
const INDUSTRIES: ChoiceOption<string>[] = [
{ value: JUDGED_INDUSTRY, label: '프리랜서, 인적용역', hint: '940909 기타자영업 (컴퓨터 프로그래머 등)' },
{ value: '73203', label: '디자이너', disabled: true },
{ value: '85699', label: '온라인 강사', disabled: true },
{ value: '59120', label: '영상 편집', disabled: true },
{ value: '47912', label: '온라인 판매', disabled: true },
{ value: 'ETC', label: '그 외', disabled: true }];


const BOOKKEEPING: ChoiceOption<BookkeepingDuty>[] = [
{ value: '복식부기', label: '복식부기', hint: '직전연도 수입 7,500만 원 이상' },
{ value: '간편장부', label: '간편장부', hint: '서비스 대상 밖 (참고용)' },
{ value: '추계', label: '추계', hint: '서비스 대상 밖 (참고용)' }];


/**
 * welcome: 가입 직후에 왔다(Signup.tsx). 이때 from 은 로그인 전에 가려던 곳이다.
 * 그 밖의 from 은 문진을 연 화면(내 정보, 판정 전 확인)이다. 저장하거나 돌아가면 그리로 간다 (C3)
 */
interface LocationState {
  welcome?: boolean;
  from?: string;
}

/** 오늘(한국 시각) 날짜. 개업일은 오늘을 넘길 수 없다 */
const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/*
 * 칸 하나가 틀렸을 때의 모양. 3번 개업일과 6번 면적 비율이 서로 달랐다 (#242 리뷰) —
 * 개업일은 빨간 글자만 띄우고 테두리는 그대로였고, 비율은 aria-invalid 만 걸어 둬서
 * 아무것도 안 보였다. 테두리와 글자를 묶어 모든 칸이 같은 식으로 알리게 한다
 */
const fieldClass =
'rounded-xl border border-edge bg-canvas px-3.5 py-2.5 text-body tabular-nums text-ink placeholder:text-muted aria-[invalid=true]:border-deny';
const fieldErrorClass = 'mt-2 text-small text-deny';
const labelClass = 'text-body-lg font-bold text-ink';

export function Interview() {
  const { contextStatus, reloadContext } = useSession();

  return (
    // 진행 단계에 없는 화면이다. 띠를 띄우면 어느 칸도 켜지지 않아 고장난 것처럼 보인다
    <AppShell showSteps={false}>
      <header>
        <StepEyebrow prefix="설정">사업자 문진</StepEyebrow>
        <h1 className="mt-1.5 text-h2 font-bold tracking-tight text-ink">사업자 문진</h1>
      </header>

      {/*
        저장된 문진을 다 읽은 뒤에 폼을 연다. 읽는 중에 고치기 시작하면 늦게 온 문진과 섞이고,
        못 읽었는데 빈 폼을 열면 저장된 답을 모른 채 새 버전을 만든다 (C57)
      */}
      {contextStatus === 'loading' ?
      <p role="status" className="mt-6 text-body text-ink2">불러오는 중…</p> :
      contextStatus === 'error' ?
      <div className="mt-6">
          <p role="alert" className="text-body text-deny">문진을 불러오지 못했습니다.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={reloadContext}>
            다시 시도
          </Button>
        </div> :

      <InterviewBody />
      }
    </AppShell>);

}

function InterviewBody() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const welcome = state?.welcome === true;
  /**
   * 가입 직후에는 올린 카드내역이 없어 판정 전 확인으로 가도 막힌다. 카드내역부터 올리게 한다.
   * 로그인 화면이 넘긴 기본값('/')이나 이 화면 자체로는 보내지 않는다 — '/' 는 랜딩이고, 같은 주소로 가면 저장 중에 멈춘다
   */
  const requested = state?.from;
  const afterWelcome = requested && requested !== '/' && requested !== '/interview' ? requested : '/upload';
  const from = !welcome && requested && requested !== '/interview' ? requested : null;
  const { userId, context, contextRef, setContext, setContextRef } = useSession();

  // 저장하지 않고 떠났던 입력이 있으면 그것으로 연다. 저장된 문진과 같으면 남길 것이 없다
  const [initial] = useState(() => {
    const draft = userId ? savedDraft(userId) : null;
    const stored = formFrom(context);
    return draft && !sameForm(draft, stored) ? { form: draft, restored: true } : { form: stored, restored: false };
  });
  const [form, setForm] = useState<InterviewForm>(initial.form);
  const [restored, setRestored] = useState(initial.restored);
  /** 한 번이라도 고쳤다. 고친 것만 임시로 남긴다 */
  const edited = useRef(initial.restored);
  /** 저장을 한 번 눌렀다. 빈 칸은 그때부터 알린다 */
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayKst();

  // 고친 것은 이 탭에 남긴다. 다른 화면에 다녀오거나 새로고침해도 말없이 버리지 않는다 (C5)
  useEffect(() => {
    if (!userId || !edited.current) return;
    saveDraft(userId, sameForm(form, formFrom(context)) ? null : form);
  }, [userId, form, context]);

  const change = (next: (prev: InterviewForm) => InterviewForm) => {
    edited.current = true;
    setForm(next);
  };

  const discardDraft = () => {
    edited.current = false;
    if (userId) saveDraft(userId, null);
    setForm(formFrom(context));
    setRestored(false);
    setAttempted(false);
  };

  const revenueRef = useRef<HTMLInputElement>(null);
  /** 쉼표를 다시 넣으면 커서가 끝으로 튄다. 커서 뒤에 있던 숫자 개수를 기억해 같은 자리로 돌려놓는다 */
  const caretFromEnd = useRef<number | null>(null);
  useLayoutEffect(() => {
    const input = revenueRef.current;
    const after = caretFromEnd.current;
    if (!input || after === null || document.activeElement !== input) return;
    caretFromEnd.current = null;
    let position = input.value.length;
    for (let seen = 0; position > 0 && seen < after; position -= 1) {
      if (/\d/.test(input.value[position - 1])) seen += 1;
    }
    input.setSelectionRange(position, position);
  });

  const { errors: found, body } = checkForm(form, today);
  // 빈 칸은 저장을 누른 뒤에 알린다. 틀린 값(앞날의 개업일, 범위 밖 비율)은 적는 대로 알린다
  const errors = attempted ?
  found :
  {
    openDate: form.openDate !== '' ? found.openDate : undefined,
    ratio: form.ratio !== '' ? found.ratio : undefined
  };

  /** 저장했거나 고친 것이 없다. 남겨 둔 입력을 지우고 간다 */
  const leave = () => {
    edited.current = false;
    if (userId) saveDraft(userId, null);
    navigate(welcome ? afterWelcome : from ?? '/confirm', { replace: welcome });
  };

  const back = () => {
    if (welcome) navigate(afterWelcome, { replace: true });
    else if (from) navigate(from);
    // 주소를 바로 열었으면 뒤로 갈 곳이 없다
    else if (location.key !== 'default') navigate(-1);
    else navigate('/account');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // 두 번 누르면 같은 문진이 버전 두 개로 저장된다
    if (saving) return;
    if (!body) {
      setAttempted(true);
      const first = FIELD_ORDER.find((field) => found[field]);
      const target = first ? document.getElementById(first) : null;
      (target instanceof HTMLInputElement ? target : target?.querySelector<HTMLElement>('[role="radio"]'))?.focus();
      return;
    }
    // 고친 것이 없으면 새 버전을 만들지 않고 그대로 간다
    if (contextRef && sameContext(body, context)) {
      leave();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ref = await api.contexts.create(body);
      setContext(body);
      setContextRef(ref);
      leave();
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError ?
        caught.message :
        '문진을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
      setSaving(false);
    }
  };

  return (
    <>
      {welcome &&
      <p role="status" className="mt-3 text-body text-ink2">
          가입을 마쳤습니다. 판정에 쓸 사업자 정보를 알려 주세요. 판정을 시작하기 전에만 마치면 됩니다.
        </p>
      }
      {restored &&
      <p role="status" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-ink2">
          저장하지 않은 입력을 이어서 보여 줍니다.
          <Button variant="ghost" size="inline" className="text-body" onClick={discardDraft}>
            되돌리기
          </Button>
        </p>
      }

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* 브라우저 말풍선 대신 칸 아래에 알린다 (C7) */}
        <form noValidate onSubmit={(event) => void submit(event)}>
          <div className="space-y-8">
            <section>
              <span className={labelClass}>1. 업종</span>
              <ChoiceGroup
                name="업종"
                className="mt-3"
                value={form.industryCode}
                onChange={(value) => change((prev) => ({ ...prev, industryCode: value }))}
                options={INDUSTRIES} />
            </section>

            <section>
              <label htmlFor="revenue" className={labelClass}>
                2. 직전연도 수입금액
              </label>
              <div className="mt-3 flex items-center gap-2">
                {/* 숫자 칸(type=number)은 지우면 0 이 남고 휠로 값이 바뀐다 (C6). 글자 칸에 쉼표를 넣어 보여 준다 */}
                <input
                  ref={revenueRef}
                  id="revenue"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="예: 50,000,000"
                  value={form.revenue === '' ? '' : formatNumber(Number(form.revenue))}
                  aria-invalid={errors.revenue !== undefined}
                  aria-describedby={errors.revenue ? 'revenue-error' : undefined}
                  onChange={(event) => {
                    const input = event.target;
                    caretFromEnd.current = input.value.slice(input.selectionStart ?? input.value.length).replace(/\D/g, '').length;
                    const digits = revenueDigits(input.value);
                    change((prev) => withRevenue(prev, digits));
                  }}
                  className={`w-56 ${fieldClass}`} />
                <span className="text-body text-ink">원</span>
              </div>
              {errors.revenue &&
              <p id="revenue-error" role="alert" className={fieldErrorClass}>{errors.revenue}</p>
              }
            </section>

            <section>
              <label htmlFor="openDate" className={labelClass}>
                3. 개업일
              </label>
              <input
                id="openDate"
                type="date"
                value={form.openDate}
                max={today}
                aria-invalid={errors.openDate !== undefined}
                aria-describedby={errors.openDate ? 'openDate-error' : undefined}
                onChange={(event) => {
                  const openDate = event.target.value;
                  change((prev) => ({ ...prev, openDate }));
                }}
                className={`mt-3 block ${fieldClass}`} />
              {errors.openDate &&
              <p id="openDate-error" role="alert" className={fieldErrorClass}>{errors.openDate}</p>
              }
            </section>

            <section>
              <span className={labelClass}>4. 기장의무</span>
              <ChoiceGroup<BookkeepingDuty | ''>
                className="mt-3"
                name="기장의무"
                value={form.duty}
                onChange={(value) => change((prev) => ({ ...prev, duty: value, dutyChosen: true }))}
                options={BOOKKEEPING} />
            </section>

            <section>
              <span className={labelClass}>5. 직원이 있나요?</span>
              <ChoiceGroup
                className="mt-3"
                name="직원 유무"
                value={form.hasEmployee}
                onChange={(value) => change((prev) => ({ ...prev, hasEmployee: value }))}
                options={[
                { value: false, label: '없음 (1인)' },
                { value: true, label: '있음', hint: '서비스 대상 밖 (참고용)' }]
                } />
            </section>

            <section id="home">
              <span className={labelClass}>6. 자택에서 작업하나요?</span>
              <ChoiceGroup<HomeAnswer>
                className="mt-3"
                name="자택 작업 여부"
                value={form.home}
                onChange={(value) => change((prev) => ({ ...prev, home: value }))}
                options={[
                { value: 'no', label: '아니요' },
                { value: 'yes', label: '예' }]
                } />
              {errors.home && <p role="alert" className={fieldErrorClass}>{errors.home}</p>}

              {form.home === 'yes' &&
              <div className="mt-5">
                  <label htmlFor="ratio" className="text-body font-bold text-ink">
                    집 전체 면적에서 작업 공간이 차지하는 비율
                  </label>
                  <div className="mt-2.5 flex items-center gap-2">
                    <input
                    id="ratio"
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.ratio}
                    placeholder="예: 25"
                    aria-invalid={errors.ratio !== undefined}
                    aria-describedby={errors.ratio ? 'ratio-error' : 'ratio-hint'}
                    onChange={(event) => {
                      const ratio = event.target.value.replace(/\D/g, '').slice(0, 3);
                      change((prev) => ({ ...prev, ratio }));
                    }}
                    className={`w-24 ${fieldClass}`} />
                    <span className="text-body font-bold text-ink">%</span>
                  </div>
                  {errors.ratio ?
                <p id="ratio-error" role="alert" className={fieldErrorClass}>{errors.ratio}</p> :

                <p id="ratio-hint" className="mt-2 text-small text-ink2">
                      방 네 칸 중 한 칸을 작업실로 쓰면 25%입니다.
                    </p>
                }
                </div>
              }
            </section>
          </div>

          {error &&
          <p role="alert" className="mt-8 text-small text-deny">
              {error}
            </p>
          }

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Button type="submit" size="md" disabled={saving}>
              {saving ? '저장하는 중…' : '저장'}
            </Button>
            <Button variant="secondary" size="md" onClick={back}>
              {welcome ? '나중에 하기' : '돌아가기'}
            </Button>
          </div>
        </form>

        {/* 수입금액을 적기 전에는 판정할 것이 없다 (C1) */}
        {form.revenue !== '' &&
        <aside className="lg:sticky lg:top-32 lg:self-start">
            <div className="rounded-2xl border border-line p-5">
              <p className="text-small text-ink2">자동 판정</p>
              <p className="mt-1 text-h4 font-bold text-ink">
                {dutyFor(Number(form.revenue)) === '복식부기' ? '복식부기 의무자' : '간편장부 대상자'}
              </p>
            </div>
          </aside>
        }
      </div>
    </>);

}
