import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_FORM,
  checkForm,
  formFrom,
  revenueDigits,
  sameContext,
  sameForm,
  saveDraft,
  savedDraft,
  withRevenue } from
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
      revenue: '',
      openDate: '',
      duty: '',
      dutyChosen: false,
      hasEmployee: false,
      home: '',
      ratio: ''
    });
  });

  it('비어 있으면 저장하지 않고 칸마다 알린다', () => {
    const { errors, body } = checkForm(EMPTY_FORM, TODAY);
    expect(body).toBeNull();
    expect(Object.keys(errors)).toEqual(['revenue', 'openDate', 'home']);
  });

  it('6번만 고르면 수입금액과 개업일이 없어 저장하지 않는다', () => {
    const { errors, body } = checkForm({ ...EMPTY_FORM, home: 'no' }, TODAY);
    expect(body).toBeNull();
    expect(errors).toEqual({ revenue: '직전연도 수입금액을 입력해 주세요.', openDate: '개업일을 입력해 주세요.' });
  });
});

describe('수입금액 칸 (C6)', () => {
  it('숫자만 남기고 앞의 0 을 지운다. 0 하나는 남긴다', () => {
    expect(revenueDigits('045000000')).toBe('45000000');
    expect(revenueDigits('83,000,000원')).toBe('83000000');
    expect(revenueDigits('0')).toBe('0');
    expect(revenueDigits('')).toBe('');
    expect(revenueDigits('12345678901234567')).toHaveLength(13);
  });

  it('기장의무를 직접 고르기 전에는 수입금액을 따라가고, 지우면 같이 비운다', () => {
    expect(withRevenue(EMPTY_FORM, '83000000').duty).toBe('복식부기');
    expect(withRevenue(EMPTY_FORM, '74999999').duty).toBe('간편장부');
    expect(withRevenue(withRevenue(EMPTY_FORM, '83000000'), '').duty).toBe('');
  });

  it('직접 고른 기장의무는 수입금액이 바뀌어도 그대로 둔다', () => {
    const chosen = { ...EMPTY_FORM, duty: '추계' as const, dutyChosen: true };
    expect(withRevenue(chosen, '90000000').duty).toBe('추계');
  });

  it('0원도 저장할 수 있다', () => {
    expect(checkForm({ ...filled, revenue: '0' }, TODAY).body?.prevYearRevenue).toBe(0);
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

  it('수입금액 기준과 다른 기장의무는 직접 고른 것으로 본다', () => {
    expect(formFrom(saved).dutyChosen).toBe(false);
    expect(formFrom({ ...saved, bookkeepingDuty: '복식부기' }).dutyChosen).toBe(true);
  });

  it('지금 판정하지 않는 업종은 판정하는 업종으로 바꿔 둔다', () => {
    expect(formFrom({ ...saved, industryCode: '62010' }).industryCode).toBe('940909');
  });

  it('자택 비율을 적지 않은 문진은 6번을 고르지 않은 것으로 연다', () => {
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
    const draft = withRevenue(EMPTY_FORM, '50000000');
    saveDraft('u1', draft);
    expect(savedDraft('u1')).toEqual(draft);
    expect(savedDraft('u2')).toBeNull();
    saveDraft('u1', null);
    expect(savedDraft('u1')).toBeNull();
  });

  it('저장된 문진으로 되돌아온 폼은 남길 것이 없는 것으로 본다', () => {
    expect(sameForm({ ...formFrom(saved) }, formFrom(saved))).toBe(true);
    expect(sameForm(withRevenue(formFrom(saved), '50000000'), formFrom(saved))).toBe(false);
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
