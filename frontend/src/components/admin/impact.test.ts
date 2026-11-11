import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { EvalCaseInfo } from '../../types/rules';
import { approveBlock, authorityOf, draftCard, hasAuthority, overlappingCases } from './impact';

const evalCase = (patch: Partial<EvalCaseInfo>): EvalCaseInfo => ({
  id: 'E-000',
  gate: 'G2',
  title: '',
  industry: '940909',
  category: '카페',
  expected: 'AVAILABLE',
  expectedGate: 'G2',
  critical: false,
  ...patch
});

describe('authorityOf', () => {
  it('법령 코퍼스의 id 를 위계로 읽는다', () => {
    expect(authorityOf('소득세법-27-1')).toBe('법률');
    expect(authorityOf('소득세법-전문')).toBe('법률');
    expect(authorityOf('소득세법시행령-61-1-1')).toBe('시행령');
    expect(authorityOf('소득세법시행규칙-25-1')).toBe('시행규칙');
    expect(authorityOf('조세특례제한법-126의2-1')).toBe('법률');
  });

  it('행정규칙, 판례, 해석례, 심판례는 법령이 아니다', () => {
    expect(authorityOf('소득세법기본통칙#2000000000-27-1')).toBe('그 밖');
    expect(authorityOf('판례-123456')).toBe('그 밖');
    expect(authorityOf('해석례-123')).toBe('그 밖');
    expect(authorityOf('심판례-2024서1234')).toBe('그 밖');
  });

  it('하나라도 법령이면 승인할 수 있다', () => {
    expect(hasAuthority(['심판례-1', '소득세법시행령-55-1-7'])).toBe(true);
    expect(hasAuthority(['심판례-1', '판례-2'])).toBe(false);
    expect(hasAuthority([])).toBe(false);
  });
});

describe('draftCard', () => {
  it('파이프라인이 쓰는 흐름 스타일 초안을 읽는다', () => {
    const yaml =
    '# 자동 생성 초안이다.\nid: TODO\ngate: G2\neffective_period: { start: TODO, end: null }\n' +
    'match:\n  category: [수리비]\n  industry: ["940909"]\nverdict: 확인필요\n' +
    'citations:\n  - { id: 소득세법-27-1, verified: true }\n  - { id: 소득세법시행령-55-1-7, verified: true }\n';
    expect(draftCard(parse(yaml))).toEqual({
      gate: 'G2',
      verdict: 'NEEDS_REVIEW',
      citations: ['소득세법-27-1', '소득세법시행령-55-1-7']
    });
  });

  it('카드 모양이 아니면 null', () => {
    expect(draftCard(parse('- a\n- b'))).toBeNull();
    expect(draftCard(null)).toBeNull();
  });

  it('판정이 없는 초안은 verdict 가 null', () => {
    expect(draftCard({ gate: 'G4', citations: [{ id: '소득세법-27-1' }] })?.verdict).toBeNull();
  });
});

describe('approveBlock', () => {
  it('하위 근거만 인용하면 막고, 읽지 못하면 막지 않는다', () => {
    expect(approveBlock({ status: 'ok', card: { gate: 'G2', verdict: 'AVAILABLE', citations: ['심판례-1'] } })).toBe(
      '규칙 카드 초안이 법률, 시행령, 시행규칙 조문을 인용하지 않아 승인할 수 없습니다.'
    );
    // 후보의 근거에 법령이 있어도 초안 카드에 인용이 없으면 막는다. 승인하면 초안이 그대로 카드가 된다
    expect(approveBlock({ status: 'ok', card: { gate: 'G2', verdict: null, citations: [] } })).toBe(
      '규칙 카드 초안에 인용 조문이 없어 승인할 수 없습니다.'
    );
    expect(approveBlock({ status: 'ok', card: { gate: 'G2', verdict: 'AVAILABLE', citations: ['소득세법-27-1'] } })).toBeNull();
    expect(approveBlock({ status: 'error' })).toBeNull();
    expect(approveBlock({ status: 'none' })).not.toBeNull();
  });
});

describe('overlappingCases', () => {
  it('카테고리가 같고 업종이 같거나 비어 있는 사례만', () => {
    const cases = [
    evalCase({ id: 'E-1' }),
    evalCase({ id: 'E-2', industry: null }),
    evalCase({ id: 'E-3', industry: '701201' }),
    evalCase({ id: 'E-4', category: '음식점' })];

    expect(overlappingCases({ merchantCategory: '카페', industryCode: '940909' }, cases).map((c) => c.id)).toEqual(['E-1', 'E-2']);
  });
});
