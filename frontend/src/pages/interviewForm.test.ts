import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_FORM,
  checkForm,
  formFrom,
  revenueDigits,
  sameContext,
  sameForm,
  saveDraft,
  savedDraft } from
'./interviewForm';
import type { BusinessContext } from '../types/domain';

const TODAY = '2026-11-06';

const saved: BusinessContext = {
  industryCode: '940909',
  prevYearRevenue: 45_000_000,
  businessOpenDate: '2024-03-01',
  bookkeepingDuty: '간편장부',
  hasEmployee: false,
  homeOfficeRatio: 25
};

const filled = { ...formFrom(saved) };

describe('새 문진 (C1)', () => {
  it('수입금액, 개업일, 기장의무, 자택은 비워 두고 업종과 직원 없음만 고른다', () => {
    expect(formFrom(null)).toEqual({
      industryCode: '940909',
      knowsRevenue: '',
      revenue: '',
      openDate: '',
      duty: '',
      hasEmployee: false,
      home: '',
      ratio: ''
    });
  });

  it('비어 있으면 저장하지 않고 칸마다 알린다', () => {
    const { errors, body } = checkForm(EMPTY_FORM, TODAY);
    expect(body).toBeNull();
    expect(Object.keys(errors)).toEqual(['knowsRevenue', 'openDate', 'home']);
  });

  it('5번만 고르면 수입금액을 아는지와 개업일이 없어 저장하지 않는다', () => {
    const { errors, body } = checkForm({ ...EMPTY_FORM, home: 'no' }, TODAY);
    expect(body).toBeNull();
    expect(errors).toEqual({ knowsRevenue: '직전연도 수입금액을 아는지 골라 주세요.', openDate: '개업일을 입력해 주세요.' });
  });
});

describe('직전연도 수입금액 (11/9)', () => {
  const base = { ...EMPTY_FORM, openDate: '2025-01-02', home: 'no' as const };

  it('알면 금액을 받고 기장의무는 7,500만 원 기준으로 정한다', () => {
    expect(checkForm({ ...base, knowsRevenue: 'yes' }, TODAY).errors.revenue).toBe('직전연도 수입금액을 입력해 주세요.');
    expect(checkForm({ ...base, knowsRevenue: 'yes', revenue: '74999999' }, TODAY).body).toMatchObject({
      prevYearRevenue: 74_999_999,
      bookkeepingDuty: '간편장부'
    });
    // 아는 경우에는 전에 골라 둔 기장의무를 쓰지 않는다
    expect(checkForm({ ...base, knowsRevenue: 'yes', revenue: '75000000', duty: '간편장부' }, TODAY).body).toMatchObject({
      prevYearRevenue: 75_000_000,
      bookkeepingDuty: '복식부기'
    });
  });

  it('0원도 저장할 수 있다', () => {
    expect(checkForm({ ...base, knowsRevenue: 'yes', revenue: '0' }, TODAY).body?.prevYearRevenue).toBe(0);
  });

  it('모르면 기장의무를 고르고 수입금액은 0원을 보낸다', () => {
    expect(checkForm({ ...base, knowsRevenue: 'no' }, TODAY).errors.duty).toBe('기장의무를 골라 주세요.');
    expect(checkForm({ ...base, knowsRevenue: 'no', revenue: '90000000', duty: '간편장부' }, TODAY).body).toMatchObject({
      prevYearRevenue: 0,
      bookkeepingDuty: '간편장부'
    });
  });

  it('수입금액 칸은 숫자만 남기고 앞의 0 을 지운다. 0 하나는 남긴다', () => {
    expect(revenueDigits('045000000')).toBe('45000000');
    expect(revenueDigits('83,000,000원')).toBe('83000000');
    expect(revenueDigits('0')).toBe('0');
    expect(revenueDigits('12345678901234567')).toHaveLength(13);
  });

  it('저장된 문진은 수입금액이 있으면 안다고, 0 이면 모른다고 연다', () => {
    expect(formFrom(saved)).toMatchObject({ knowsRevenue: 'yes', revenue: '45000000' });
    expect(formFrom({ ...saved, prevYearRevenue: 0, bookkeepingDuty: '복식부기' })).toMatchObject({
      knowsRevenue: 'no',
      revenue: '',
      duty: '복식부기'
    });
  });
});

describe('개업일과 자택 (C7)', () => {
  it('앞날의 개업일은 막는다', () => {
    expect(checkForm({ ...filled, openDate: '2026-11-07' }, TODAY).errors.openDate).toBe(
      '개업일은 오늘이나 그 전이어야 합니다.'
    );
    expect(checkForm({ ...filled, openDate: TODAY }, TODAY).body).not.toBeNull();
  });

  it('자택에서 일하면 1과 100 사이의 비율이 있어야 한다', () => {
    expect(checkForm({ ...filled, home: 'yes', ratio: '' }, TODAY).errors.ratio).toBeDefined();
    expect(checkForm({ ...filled, home: 'yes', ratio: '101' }, TODAY).errors.ratio).toBeDefined();
    expect(checkForm({ ...filled, home: 'yes', ratio: '30' }, TODAY).body?.homeOfficeRatio).toBe(30);
    expect(checkForm({ ...filled, home: 'no', ratio: '30' }, TODAY).body?.homeOfficeRatio).toBe(0);
  });
});

describe('저장된 문진', () => {
  it('폼으로 옮겼다가 그대로 저장하면 저장된 것과 같다. 새 버전을 만들지 않는다', () => {
    const body = checkForm(formFrom(saved), TODAY).body ?? saved;
    expect(checkForm(formFrom(saved), TODAY).body).toEqual(saved);
    expect(sameContext(body, saved)).toBe(true);
    expect(sameContext(body, null)).toBe(false);
    expect(sameContext({ ...body, prevYearRevenue: 46_000_000 }, saved)).toBe(false);
  });

  it('예전에 고른 추계는 비워 두고 다시 고르게 한다', () => {
    expect(formFrom({ ...saved, bookkeepingDuty: '복식부기' }).duty).toBe('복식부기');
    expect(formFrom({ ...saved, bookkeepingDuty: '추계' }).duty).toBe('');
  });

  it('지금 판정하지 않는 업종은 판정하는 업종으로 바꿔 둔다', () => {
    expect(formFrom({ ...saved, industryCode: '62010' }).industryCode).toBe('940909');
  });

  it('직원 있음은 고를 수 없어(준비 중) 없음으로 연다', () => {
    expect(formFrom({ ...saved, hasEmployee: true }).hasEmployee).toBe(false);
  });

  it('자택 비율을 적지 않은 문진은 5번을 고르지 않은 것으로 연다', () => {
    expect(formFrom({ ...saved, homeOfficeRatio: null }).home).toBe('');
    expect(formFrom({ ...saved, homeOfficeRatio: 0 }).home).toBe('no');
  });
});

describe('임시 저장 (C5)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const memoryStorage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key)
    };
  };

  it('계정마다 따로 남기고, null 이면 지운다', () => {
    vi.stubGlobal('sessionStorage', memoryStorage());
    const draft = { ...EMPTY_FORM, duty: '복식부기' as const };
    saveDraft('u1', draft);
    expect(savedDraft('u1')).toEqual(draft);
    expect(savedDraft('u2')).toBeNull();
    saveDraft('u1', null);
    expect(savedDraft('u1')).toBeNull();
  });

  it('저장된 문진으로 되돌아온 폼은 남길 것이 없는 것으로 본다', () => {
    expect(sameForm({ ...formFrom(saved) }, formFrom(saved))).toBe(true);
    expect(sameForm({ ...formFrom(saved), duty: '복식부기' }, formFrom(saved))).toBe(false);
  });

  it('저장소를 쓸 수 없으면 남기지 않고 던지지도 않는다', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    vi.stubGlobal('sessionStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(() => saveDraft('u1', EMPTY_FORM)).not.toThrow();
    expect(savedDraft('u1')).toBeNull();
  });
});

describe('예전 화면의 임시 값', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('고를 수 없는 추계와 지운 칸은 버리고, 적어 둔 금액이 있으면 안다고 본다', () => {
    const map = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key)
    });
    // 수입금액을 아는지 묻기 전의 화면이 남긴 값이다
    const old: Partial<typeof filled> = { ...filled };
    delete old.knowsRevenue;
    map.set('preet:interview:u1', JSON.stringify({ ...old, revenue: '90000000', duty: '추계', dutyChosen: true }));
    const draft = savedDraft('u1');
    expect(draft).not.toHaveProperty('dutyChosen');
    expect(draft).toMatchObject({ knowsRevenue: 'yes', revenue: '90000000', duty: '' });
    expect(checkForm(draft ?? EMPTY_FORM, TODAY).body?.bookkeepingDuty).toBe('복식부기');
    map.set('preet:interview:u1', JSON.stringify({ ...old, revenue: '', duty: '추계' }));
    expect(checkForm(savedDraft('u1') ?? EMPTY_FORM, TODAY).errors.knowsRevenue).toBeDefined();
  });
});
