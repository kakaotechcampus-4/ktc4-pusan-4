import type { BookkeepingDuty, BusinessContext, StoredBusinessContext } from '../types/domain';
import { isJudgedIndustry } from '../utils/context';

/** 지금 판정하는 업종(프리랜서, 인적용역). 다른 업종은 화면에 보이되 고를 수 없다 */
export const JUDGED_INDUSTRY = '940909';

/** 5번 「자택에서 작업하나요?」, 2번 「직전연도 수입금액을 알고 있나요?」. 빈 값은 아직 고르지 않음이다 */
export type HomeAnswer = 'yes' | 'no' | '';
export type KnowsRevenue = 'yes' | 'no' | '';

/**
 * 문진 폼이 드는 값. 칸에 보이는 그대로 들고, 저장할 때 BusinessContext 로 바꾼다.
 * 문자열로 들어서 빈 칸을 0 이나 지어낸 기본값으로 채우지 않는다 (C1, C6). 임시 저장(C5)도 이 모양 그대로다
 */
export interface InterviewForm {
  industryCode: string;
  /** 직전연도 수입금액을 아는가. 알면 금액을 적고 기장의무는 금액으로 정한다. 모르면 기장의무를 고른다 */
  knowsRevenue: KnowsRevenue;
  /**
   * 직전연도 수입금액(숫자만). 빈 값은 아직 적지 않음. 모른다고 하면 서버에 0 을 보낸다.
   * 서버는 접대비 한도(기본 1,200만 원 + 수입금액의 0.3%)에만 쓴다
   */
  revenue: string;
  /** YYYY-MM-DD. 빈 값은 아직 적지 않음. 날짜를 일부만 지우면 브라우저가 빈 값을 준다 */
  openDate: string;
  duty: BookkeepingDuty | '';
  hasEmployee: boolean;
  home: HomeAnswer;
  /** 작업 공간 면적 비율. 숫자만 */
  ratio: string;
}

/**
 * 새 문진. 업종과 「없음 (1인)」은 서비스 대상이라 미리 고른다. 수입금액, 개업일, 기장의무는 사용자의
 * 사실이라 비워 둔다 — 채워 두면 5번만 고르고 저장해도 지어낸 값이 그대로 문진이 됐다 (C1).
 * 자택 비율도 같은 이유로 비운다 (#214)
 */
export const EMPTY_FORM: InterviewForm = {
  industryCode: JUDGED_INDUSTRY,
  knowsRevenue: '',
  revenue: '',
  openDate: '',
  duty: '',
  hasEmployee: false,
  home: '',
  ratio: ''
};

/** 문진에서 고를 수 있는 기장의무. 추계는 기장의무가 아니라 신고 방법이라 묻지 않는다 */
export const PICKABLE_DUTIES: BookkeepingDuty[] = ['간편장부', '복식부기'];

/** 인적용역(940909)은 직전연도 수입 7,500만 원부터 복식부기 의무다 (소득세법 시행령 제208조 제5항) */
const DOUBLE_ENTRY_FROM = 75_000_000;
export const dutyFor = (revenue: number): BookkeepingDuty => revenue >= DOUBLE_ENTRY_FROM ? '복식부기' : '간편장부';

/**
 * 수입금액 칸에 친 글자에서 숫자만 남긴다. 쉼표나 「원」을 붙여 넣어도 된다.
 * 앞의 0 은 지우되 0 하나는 남긴다 — 지난해 수입이 없을 수 있다. 13자리(조 단위)에서 자른다
 */
export const revenueDigits = (typed: string) => typed.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13);

/**
 * 저장된 문진으로 폼을 채운다. 지금 고를 수 없는 업종은 판정하는 업종으로 바꿔 둔다 —
 * 업종 코드가 바뀌기 전 문진을 다시 보내지 않게 한다. 예전에 고른 추계도 같은 이유로 비워 다시 고르게 하고, 직원 있음은 없음으로 둔다.
 * 수입금액이 0 보다 크면 안다고 답한 것이고, 0 이면 모른다고 답한 것으로 연다(지난해 수입이 0 원인 사람도 기장의무는 간편장부라 같다)
 */
export function formFrom(saved: BusinessContext | StoredBusinessContext | null): InterviewForm {
  if (!saved) return EMPTY_FORM;
  const ratio = saved.homeOfficeRatio;
  return {
    industryCode: isJudgedIndustry(saved.industryCode) ? saved.industryCode : JUDGED_INDUSTRY,
    knowsRevenue: saved.prevYearRevenue > 0 ? 'yes' : 'no',
    revenue: saved.prevYearRevenue > 0 ? String(saved.prevYearRevenue) : '',
    openDate: saved.businessOpenDate,
    duty: PICKABLE_DUTIES.includes(saved.bookkeepingDuty) ? saved.bookkeepingDuty : '',
    // 직원 있음은 지금 고를 수 없다(준비 중). 업종처럼 고를 수 있는 값으로 바꿔 둔다
    hasEmployee: false,
    home: ratio === null ? '' : ratio > 0 ? 'yes' : 'no',
    ratio: ratio !== null && ratio > 0 ? String(ratio) : ''
  };
}

export type InterviewField = 'knowsRevenue' | 'revenue' | 'duty' | 'openDate' | 'home' | 'ratio';
export type InterviewErrors = Partial<Record<InterviewField, string>>;

/** 화면 위에서 아래 순서. 저장이 막히면 이 순서로 처음 틀린 칸에 초점을 준다 */
export const FIELD_ORDER: InterviewField[] = ['knowsRevenue', 'revenue', 'duty', 'openDate', 'home', 'ratio'];

const ratioOf = (text: string) => {
  const ratio = /^\d{1,3}$/.test(text) ? Number(text) : NaN;
  return ratio >= 1 && ratio <= 100 ? ratio : null;
};

/** 칸마다의 오류와, 오류가 없으면 보낼 문진. today 는 한국 시각 YYYY-MM-DD 다 */
export function checkForm(form: InterviewForm, today: string): {errors: InterviewErrors;body: BusinessContext | null;} {
  const errors: InterviewErrors = {};
  if (form.knowsRevenue === '') errors.knowsRevenue = '직전연도 수입금액을 아는지 골라 주세요.';
  if (form.knowsRevenue === 'yes' && form.revenue === '') errors.revenue = '직전연도 수입금액을 입력해 주세요.';
  if (form.knowsRevenue === 'no' && form.duty === '') errors.duty = '기장의무를 골라 주세요.';
  if (form.openDate === '') errors.openDate = '개업일을 입력해 주세요.';
  else if (form.openDate > today) errors.openDate = '개업일은 오늘이나 그 전이어야 합니다.';
  if (form.home === '') errors.home = '자택에서 작업하는지 골라 주세요.';
  const ratio = ratioOf(form.ratio);
  if (form.home === 'yes' && ratio === null) errors.ratio = '1과 100 사이의 숫자를 입력해 주세요.';
  if (Object.keys(errors).length > 0) return { errors, body: null };
  const known = form.knowsRevenue === 'yes';
  const revenue = known ? Number(form.revenue) : 0;
  // 모른다고 한 뒤 기장의무를 골랐다. 안다고 했으면 금액으로 정한다
  const duty = known ? dutyFor(revenue) : form.duty;
  if (duty === '') return { errors, body: null };
  return {
    errors,
    body: {
      industryCode: form.industryCode,
      prevYearRevenue: revenue,
      businessOpenDate: form.openDate,
      bookkeepingDuty: duty,
      hasEmployee: form.hasEmployee,
      homeOfficeRatio: form.home === 'yes' ? ratio : 0
    }
  };
}

/** 저장된 문진과 같은가. 같으면 확정을 눌러도 새 버전을 만들지 않는다 */
export const sameContext = (body: BusinessContext, saved: BusinessContext | null) =>
  saved !== null && (Object.keys(body) as (keyof BusinessContext)[]).every((key) => body[key] === saved[key]);

export const sameForm = (a: InterviewForm, b: InterviewForm) =>
  (Object.keys(EMPTY_FORM) as (keyof InterviewForm)[]).every((key) => a[key] === b[key]);

const draftKey = (userId: string) => `preet:interview:${userId}`;

/**
 * 저장하지 않고 떠난 문진 (C5). 다른 화면에 다녀오거나 새로고침해도 이어 쓴다. 탭을 닫으면 사라진다.
 * 저장소를 막아 둔 브라우저에서는 읽기와 쓰기가 던진다. 그때는 남기지 않는다
 */
export function savedDraft(userId: string): InterviewForm | null {
  try {
    const raw = sessionStorage.getItem(draftKey(userId));
    if (!raw) return null;
    // 예전 화면이 남긴 임시 값은 지금 폼에 없는 칸(dutyChosen)과 고를 수 없는 기장의무(추계)를 가질 수 있다.
    // 수입금액을 아는지 묻기 전의 값이면 적어 둔 금액이 있을 때 안다고 본다
    const parsed = JSON.parse(raw) as Partial<InterviewForm>;
    const { industryCode, revenue, openDate, duty, home, ratio } = { ...EMPTY_FORM, ...parsed };
    const knowsRevenue = parsed.knowsRevenue ?? (revenue !== '' ? 'yes' : '');
    return {
      industryCode,
      knowsRevenue,
      revenue,
      openDate,
      duty: duty && PICKABLE_DUTIES.includes(duty) ? duty : '',
      // 직원 있음은 지금 고를 수 없다(준비 중)
      hasEmployee: false,
      home,
      ratio
    };
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, form: InterviewForm | null) {
  try {
    if (form) sessionStorage.setItem(draftKey(userId), JSON.stringify(form));
    else sessionStorage.removeItem(draftKey(userId));
  } catch {
    // 남기지 못해도 지금 폼은 그대로 쓴다
  }
}
