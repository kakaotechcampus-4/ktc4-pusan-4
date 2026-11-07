import type { BookkeepingDuty, BusinessContext, StoredBusinessContext } from '../types/domain';
import { isJudgedIndustry } from '../utils/context';

/** 지금 판정하는 업종(프리랜서, 인적용역). 다른 업종은 화면에 보이되 고를 수 없다 */
export const JUDGED_INDUSTRY = '940909';

/** 6번 「자택에서 작업하나요?」. 빈 값은 아직 고르지 않음이다 */
export type HomeAnswer = 'yes' | 'no' | '';

/**
 * 문진 폼이 드는 값. 칸에 보이는 그대로 들고, 저장할 때 BusinessContext 로 바꾼다.
 * 문자열로 들어서 빈 칸을 0 이나 지어낸 기본값으로 채우지 않는다 (C1, C6). 임시 저장(C5)도 이 모양 그대로다
 */
export interface InterviewForm {
  industryCode: string;
  /** 숫자만. 빈 값은 아직 적지 않음 */
  revenue: string;
  /** YYYY-MM-DD. 빈 값은 아직 적지 않음. 날짜를 일부만 지우면 브라우저가 빈 값을 준다 */
  openDate: string;
  duty: BookkeepingDuty | '';
  /** 기장의무를 직접 골랐다. 고르기 전에는 수입금액을 따라간다 */
  dutyChosen: boolean;
  hasEmployee: boolean;
  home: HomeAnswer;
  /** 작업 공간 면적 비율. 숫자만 */
  ratio: string;
}

/**
 * 새 문진. 업종과 「없음 (1인)」은 서비스 대상이라 미리 고른다. 수입금액, 개업일, 기장의무는 사용자의
 * 사실이라 비워 둔다 — 채워 두면 6번만 고르고 저장해도 지어낸 값이 그대로 문진이 됐다 (C1).
 * 자택 비율도 같은 이유로 비운다 (#214)
 */
export const EMPTY_FORM: InterviewForm = {
  industryCode: JUDGED_INDUSTRY,
  revenue: '',
  openDate: '',
  duty: '',
  dutyChosen: false,
  hasEmployee: false,
  home: '',
  ratio: ''
};

/** 인적용역(940909)은 직전연도 수입 7,500만 원부터 복식부기 의무다. 화면 힌트와 같은 기준이다 */
const DOUBLE_ENTRY_FROM = 75_000_000;
export const dutyFor = (revenue: number): BookkeepingDuty => revenue >= DOUBLE_ENTRY_FROM ? '복식부기' : '간편장부';

/**
 * 저장된 문진으로 폼을 채운다. 지금 고를 수 없는 업종은 판정하는 업종으로 바꿔 둔다 —
 * 업종 코드가 바뀌기 전 문진을 다시 보내지 않게 한다. 저장된 기장의무가 수입금액 기준과 다르면 예전에 직접 고른 것이다
 */
export function formFrom(saved: BusinessContext | StoredBusinessContext | null): InterviewForm {
  if (!saved) return EMPTY_FORM;
  const ratio = saved.homeOfficeRatio;
  return {
    industryCode: isJudgedIndustry(saved.industryCode) ? saved.industryCode : JUDGED_INDUSTRY,
    revenue: String(saved.prevYearRevenue),
    openDate: saved.businessOpenDate,
    duty: saved.bookkeepingDuty,
    dutyChosen: saved.bookkeepingDuty !== dutyFor(saved.prevYearRevenue),
    hasEmployee: saved.hasEmployee,
    home: ratio === null ? '' : ratio > 0 ? 'yes' : 'no',
    ratio: ratio !== null && ratio > 0 ? String(ratio) : ''
  };
}

/**
 * 수입금액 칸에 친 글자에서 숫자만 남긴다. 쉼표나 「원」을 붙여 넣어도 된다.
 * 앞의 0 은 지우되 0 하나는 남긴다 — 지난해 수입이 없을 수 있다. 13자리(조 단위)에서 자른다
 */
export const revenueDigits = (typed: string) => typed.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13);

/** 수입금액을 바꾼다. 기장의무를 직접 고르기 전이면 수입금액을 따라가고, 수입금액을 지우면 같이 비운다 */
export function withRevenue(form: InterviewForm, revenue: string): InterviewForm {
  if (form.dutyChosen) return { ...form, revenue };
  return { ...form, revenue, duty: revenue === '' ? '' : dutyFor(Number(revenue)) };
}

export type InterviewField = 'revenue' | 'openDate' | 'home' | 'ratio';
export type InterviewErrors = Partial<Record<InterviewField, string>>;

/** 화면 위에서 아래 순서. 저장이 막히면 이 순서로 처음 틀린 칸에 초점을 준다 */
export const FIELD_ORDER: InterviewField[] = ['revenue', 'openDate', 'home', 'ratio'];

const ratioOf = (text: string) => {
  const ratio = /^\d{1,3}$/.test(text) ? Number(text) : NaN;
  return ratio >= 1 && ratio <= 100 ? ratio : null;
};

/** 칸마다의 오류와, 오류가 없으면 보낼 문진. today 는 한국 시각 YYYY-MM-DD 다 */
export function checkForm(form: InterviewForm, today: string): {errors: InterviewErrors;body: BusinessContext | null;} {
  const errors: InterviewErrors = {};
  if (form.revenue === '') errors.revenue = '직전연도 수입금액을 입력해 주세요.';
  if (form.openDate === '') errors.openDate = '개업일을 입력해 주세요.';
  else if (form.openDate > today) errors.openDate = '개업일은 오늘이나 그 전이어야 합니다.';
  if (form.home === '') errors.home = '자택에서 작업하는지 골라 주세요.';
  const ratio = ratioOf(form.ratio);
  if (form.home === 'yes' && ratio === null) errors.ratio = '1과 100 사이의 숫자를 입력해 주세요.';
  if (Object.keys(errors).length > 0) return { errors, body: null };
  const revenue = Number(form.revenue);
  return {
    errors,
    body: {
      industryCode: form.industryCode,
      prevYearRevenue: revenue,
      businessOpenDate: form.openDate,
      bookkeepingDuty: form.duty || dutyFor(revenue),
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
    return raw ? { ...EMPTY_FORM, ...(JSON.parse(raw) as Partial<InterviewForm>) } : null;
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
