import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRightIcon, InfoIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { DEFAULT_CONTEXT, useSession } from '../contexts/SessionContext';
import { api, ApiRequestError } from '../api';
import type { BookkeepingDuty, BusinessContext, StoredBusinessContext } from '../types/domain';
import { ChoiceGroup, type ChoiceOption } from '../components/ui';
import { formatNumber } from '../utils/format';

/**
 * 서비스는 프리랜서·인적용역(940909)만 동작한다. 다른 직종은 보이되 선택되지 않는다 —
 * 있지만 안 되는 선택지는 '준비 중'으로 표기한다 (DESIGN.md).
 */
const INDUSTRIES: ChoiceOption<string>[] = [
{ value: '940909', label: '프리랜서 · 인적용역', hint: '940909 기타자영업 (컴퓨터 프로그래머 등)' },
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
 * 저장된 문진으로 폼을 채운다. 보낼 필드만 골라 담는다(서버가 붙인 id·version 은 보내지 않는다).
 * 지금 고를 수 없는 업종은 기본값으로 둔다 — 업종 코드가 바뀌기 전 문진을 다시 보내지 않게 한다.
 * 자택 비율이 미입력(null)이면 새 폼과 같은 값으로 시작한다
 */
const formFrom = (saved: BusinessContext | StoredBusinessContext | null): BusinessContext =>
saved ?
{
  industryCode: INDUSTRIES.some((option) => !option.disabled && option.value === saved.industryCode) ?
  saved.industryCode :
  DEFAULT_CONTEXT.industryCode,
  prevYearRevenue: saved.prevYearRevenue,
  businessOpenDate: saved.businessOpenDate,
  bookkeepingDuty: saved.bookkeepingDuty,
  hasEmployee: saved.hasEmployee,
  homeOfficeRatio: saved.homeOfficeRatio
} :
DEFAULT_CONTEXT;

/** 6번 「자택에서 작업하나요?」. 빈 값은 아직 고르지 않음이다 */
type HomeAnswer = 'yes' | 'no' | '';
const homeAnswerOf = (ratio: number | null): HomeAnswer => ratio === null ? '' : ratio > 0 ? 'yes' : 'no';
const ratioTextOf = (ratio: number | null) => ratio !== null && ratio > 0 ? String(ratio) : '';

/** 가입 직후에 왔다(Signup.tsx). from 은 로그인 전에 가려던 곳이다 */
interface LocationState {
  welcome?: boolean;
  from?: string;
}

/** 인적용역(940909)은 직전연도 수입 7,500만 원부터 복식부기 의무다. 화면 힌트와 같은 기준이다 */
const DOUBLE_ENTRY_FROM = 75_000_000;
const dutyFor = (revenue: number): BookkeepingDuty => revenue >= DOUBLE_ENTRY_FROM ? '복식부기' : '간편장부';

/** 오늘(한국 시각) 날짜. 개업일은 오늘을 넘길 수 없다 */
const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/*
 * 칸 하나가 틀렸을 때의 모양. 3번 개업일과 6번 면적 비율이 서로 달랐다 (#242 리뷰) —
 * 개업일은 빨간 글자만 띄우고 테두리는 그대로였고, 비율은 aria-invalid 만 걸어 둬서
 * 아무것도 안 보였다. 테두리와 글자를 묶어 두 칸이 같은 식으로 알리게 한다
 */
const fieldClass =
'rounded-xl border border-line px-3.5 py-2.5 text-[14px] tabular-nums text-ink aria-[invalid=true]:border-deny';
const fieldErrorClass = 'mt-2 text-small text-deny';

const cardClass = 'rounded-2xl border border-line bg-surface p-5';
const labelClass = 'text-[14px] font-bold text-ink';
const hintClass = 'mt-1 text-[13px] leading-6 text-muted';

export function Interview() {
  const navigate = useNavigate();
  const location = useLocation();
  const welcome = (location.state as LocationState | null)?.welcome === true;
  /**
   * 가입 직후에는 올린 카드내역이 없어 판정 확인으로 가도 막힌다. 카드내역부터 올리게 한다.
   * 로그인 화면이 넘긴 기본값('/')이나 이 화면 자체로는 보내지 않는다 — '/' 는 랜딩이고, 같은 주소로 가면 저장 중에 멈춘다
   */
  const requested = (location.state as LocationState | null)?.from;
  const afterWelcome = requested && requested !== '/' && requested !== '/interview' ? requested : '/upload';
  const { context, setContext, setContextRef } = useSession();
  const [form, setForm] = useState<BusinessContext>(() => formFrom(context));
  /**
   * 자택 작업 여부와 면적 비율은 폼과 따로 든다. 비율을 미리 채워 두지 않으므로(#214) 「예」를 고르고
   * 아직 적지 않은 상태가 있다. 저장할 때 homeOfficeRatio 로 합친다
   */
  const [home, setHome] = useState<HomeAnswer>(() => homeAnswerOf(formFrom(context).homeOfficeRatio));
  const [ratioText, setRatioText] = useState(() => ratioTextOf(formFrom(context).homeOfficeRatio));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 한 번이라도 고쳤으면 늦게 온 저장 문진으로 덮지 않는다 */
  const edited = useRef(false);
  /**
   * 기장의무를 직접 골랐으면 수입금액이 바뀌어도 바꾸지 않는다. 고르기 전에는 수입금액을 따라간다.
   * 저장된 문진의 기장의무가 수입금액 기준과 다르면 예전에 직접 고른 것이다
   */
  const dutyChosen = useRef(context !== null && context.bookkeepingDuty !== dutyFor(context.prevYearRevenue));
  const today = todayKst();

  // 새로고침 직후에는 저장된 문진(3.2)이 화면보다 늦게 온다
  useEffect(() => {
    if (edited.current) return;
    const next = formFrom(context);
    dutyChosen.current = context !== null && context.bookkeepingDuty !== dutyFor(context.prevYearRevenue);
    setForm(next);
    setHome(homeAnswerOf(next.homeOfficeRatio));
    setRatioText(ratioTextOf(next.homeOfficeRatio));
  }, [context]);

  const update = <K extends keyof BusinessContext,>(
  key: K,
  value: BusinessContext[K]) =>
  {
    edited.current = true;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const bookkeeping =
  dutyFor(form.prevYearRevenue) === '복식부기' ? '복식부기 의무자' : '간편장부 대상자';
  const futureOpen = form.businessOpenDate > today;
  const ratio = /^\d{1,3}$/.test(ratioText) ? Number(ratioText) : NaN;
  const ratioValid = ratio >= 1 && ratio <= 100;

  const impacts = [
  form.hasEmployee ?
  '직원이 있어 복리후생비·급여 관련 판정 분기가 켜집니다.' :
  '직원이 없어 회식·복리후생 성격의 지출은 가사 관련 경비로 봅니다.',
  home === 'no' ?
  '자택에서 일하지 않아 월세·관리비·공과금을 나누어 보지 않습니다.' :
  home === 'yes' && ratioValid ?
  `작업 공간이 따로 나뉜 자택의 월세·관리비·공과금은 ${ratio}%만 경비로 봅니다. 나뉘지 않으면 세무사 확인으로 넘깁니다.` :
  '작업 공간 면적 비율을 적으면 자택의 월세·관리비·공과금을 그 비율만큼 경비로 봅니다.'];


  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // 두 번 누르면 같은 문진이 버전 두 개로 저장된다
    if (saving) return;
    if (futureOpen) {
      setError('개업일이 오늘보다 뒤입니다. 날짜를 확인해 주세요.');
      return;
    }
    if (home === '') {
      setError('6번, 자택에서 작업하는지 골라 주세요.');
      return;
    }
    if (home === 'yes' && !ratioValid) {
      setError('작업 공간 면적 비율을 1~100 사이 숫자로 적어 주세요.');
      return;
    }
    const body: BusinessContext = { ...form, homeOfficeRatio: home === 'yes' ? ratio : 0 };
    setSaving(true);
    setError(null);
    try {
      const ref = await api.contexts.create(body);
      setContext(body);
      setContextRef(ref);
      navigate(welcome ? afterWelcome : '/confirm', { replace: welcome });
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
    // 진행 단계에 없는 화면이다. 띠를 띄우면 어느 칸도 켜지지 않아 고장난 것처럼 보인다
    <AppShell showSteps={false}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={(event) => void submit(event)}>
          <header>
            <p className="text-[13px] font-bold text-accent">설정 · 사업자 문진</p>
            <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-ink">
              사업자 문진
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-6 text-ink2">
              같은 지출도 사업자 상황에 따라 결과가 달라집니다. 답변은 버전으로
              저장되고, 판정 결과에는 어떤 버전으로 판단했는지 기록됩니다.
            </p>
          </header>

          {welcome &&
          <p
            role="status"
            className="mt-5 rounded-xl border border-accent-line bg-accent-soft px-4 py-3 text-[14px] leading-6 text-ink2">

              가입을 마쳤습니다. 판정에 쓸 사업자 정보를 먼저 알려 주세요. 지금 하지 않아도 되고,
              판정을 시작하기 전에만 마치면 됩니다.
            </p>
          }

          <div className="mt-6 space-y-4">
            <section className={cardClass}>
              <span className={labelClass}>1. 업종</span>
              <p className={hintClass}>
                지금은 프리랜서·인적용역(940909)만 판정합니다. 다른 직종은 규칙 카드가 준비되면
                열립니다.
              </p>
              <ChoiceGroup
                name="업종"
                className="mt-3"
                value={form.industryCode}
                onChange={(value) => update('industryCode', value)}
                options={INDUSTRIES} />
            </section>

            <section className={cardClass}>
              <label htmlFor="revenue" className={labelClass}>
                2. 직전연도 수입금액
              </label>
              <p className={hintClass}>
                기장 의무와 연중 한도 잠정 계산의 기준입니다.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  id="revenue"
                  type="number"
                  min={0}
                  value={form.prevYearRevenue}
                  onChange={(event) => {
                    const revenue = Number(event.target.value);
                    update('prevYearRevenue', revenue);
                    if (!dutyChosen.current) update('bookkeepingDuty', dutyFor(revenue));
                  }}
                  className="w-56 rounded-xl border border-line px-3.5 py-2.5 text-[14px] tabular-nums text-ink" />
                
                <span className="text-[13px] tabular-nums text-muted">
                  {formatNumber(form.prevYearRevenue)}원
                </span>
              </div>
            </section>

            <section className={cardClass}>
              <label htmlFor="openDate" className={labelClass}>
                3. 개업일
              </label>
              <p className={hintClass}>신규 사업자 여부에 따라 경비율 구간이 달라집니다.</p>
              <input
                id="openDate"
                type="date"
                value={form.businessOpenDate}
                max={today}
                aria-invalid={futureOpen}
                onChange={(event) =>
                update('businessOpenDate', event.target.value)
                }
                className={`mt-3 ${fieldClass}`} />
              {futureOpen &&
              <p role="alert" className={fieldErrorClass}>개업일은 오늘이나 그 전이어야 합니다.</p>
              }
              
            </section>

            <section className={cardClass}>
              <span className={labelClass}>4. 기장의무</span>
              <p className={hintClass}>
                직전연도 수입금액으로 자동 판정된 값이 기본 선택됩니다.
              </p>
              <ChoiceGroup
                className="mt-3"
                name="기장의무"
                value={form.bookkeepingDuty}
                onChange={(value) => {
                  dutyChosen.current = true;
                  update('bookkeepingDuty', value);
                }}
                options={BOOKKEEPING} />
              
            </section>

            <section className={cardClass}>
              <span className={labelClass}>5. 직원이 있나요?</span>
              <p className={hintClass}>
                직원 보유 사업자는 서비스 대상 밖입니다. 복리후생비 판정에만
                사용합니다.
              </p>
              <ChoiceGroup
                className="mt-3"
                name="직원 유무"
                value={form.hasEmployee}
                onChange={(value) => update('hasEmployee', value)}
                options={[
                { value: false, label: '없음 (1인)' },
                { value: true, label: '있음' }]
                } />
              
            </section>

            <section className={cardClass}>
              <span className={labelClass}>6. 자택에서 작업하나요?</span>
              <p className={hintClass}>
                자택 안에 작업 공간이 따로 나뉘어 있으면, 월세·관리비·전기·수도·가스를 그 면적 비율만큼
                경비로 봅니다. 따로 나뉘는지는 해당 거래의 질문에서 다시 묻습니다.
              </p>
              <ChoiceGroup<HomeAnswer>
                className="mt-3"
                name="자택 작업 여부"
                value={home}
                onChange={(value) => {
                  edited.current = true;
                  setHome(value);
                }}
                options={[
                { value: 'no', label: '아니오', hint: '자택에서 일하지 않음' },
                { value: 'yes', label: '예', hint: '작업 공간 면적 비율을 적습니다' }]
                } />
              
              {home === 'yes' &&
              <div className="mt-4 rounded-xl bg-canvas p-4">
                  <label
                  htmlFor="ratio"
                  className="text-[13px] font-bold text-ink">
                  
                    집 전체 면적에서 작업 공간이 차지하는 비율
                  </label>
                  <div className="mt-2.5 flex items-center gap-2">
                    <input
                    id="ratio"
                    inputMode="numeric"
                    value={ratioText}
                    placeholder="예: 25"
                    aria-invalid={ratioText !== '' && !ratioValid}
                    onChange={(event) => {
                      edited.current = true;
                      setRatioText(event.target.value.replace(/\D/g, '').slice(0, 3));
                    }}
                    className={`w-24 ${fieldClass}`} />
                  
                    <span className="text-[14px] font-bold text-ink">%</span>
                  </div>
                  {ratioText !== '' && !ratioValid &&
                <p role="alert" className={fieldErrorClass}>1 과 100 사이의 숫자를 적어 주세요.</p>
                }
                  <p className="mt-2 text-[12px] leading-5 text-muted">
                    미리 채워 두지 않습니다. 대략이라도 실제 면적으로 적어 주세요. 예: 방 네 칸 중 한 칸을 작업실로 쓰면 25%.
                  </p>
                </div>
              }
            </section>
          </div>

          {error &&
          <p
            role="alert"
            className="mt-6 rounded-xl border border-deny-line bg-deny-bg px-4 py-3 text-small leading-6 text-deny">

              {error}
            </p>
          }

          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition-colors duration-150 ease-snap hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-muted">

              {saving ? '저장하는 중…' : '다음: 입력 확정'}
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => welcome ? navigate(afterWelcome, { replace: true }) : navigate('/upload')}
              className="text-[13px] font-normal text-muted transition-colors duration-150 hover:text-ink">
              
              {welcome ? '나중에 하기' : '이전 단계'}
            </button>
          </div>
        </form>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-[12px] text-muted">자동 판정</p>
            <p className="mt-1 text-[18px] font-bold text-ink">{bookkeeping}</p>
            <p className="mt-2 text-[13px] leading-6 text-muted">
              직전연도 수입금액 {formatNumber(form.prevYearRevenue)}원 기준으로
              산정했습니다.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center gap-2">
              <InfoIcon className="h-4 w-4 text-accent" aria-hidden="true" />
              <h2 className="text-sm font-bold text-ink">
                이 답변이 바꾸는 것
              </h2>
            </div>
            <ul className="mt-3 space-y-2.5">
              {impacts.map((impact) =>
              <li
                key={impact}
                className="text-[13px] leading-6 text-ink2 before:mr-1.5 before:text-muted before:content-['·']">
                
                  {impact}
                </li>
              )}
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>);

}