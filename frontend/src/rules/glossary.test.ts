import { describe, expect, it } from 'vitest';
import { GLOSSARY, lookup } from './glossary';

describe('용어집', () => {
  it('rules/glossary.yaml 의 21개를 담는다', () => {
    expect(GLOSSARY).toHaveLength(21);
  });

  it('고른 글이 낱말이나 다른 표기 하나와 같으면 그 항목을 준다', () => {
    expect(lookup('접대비')?.term).toBe('기업업무추진비');
    expect(lookup(' 확인 필요 ')?.term).toBe('확인 필요');
    expect(lookup('확인필요.')?.term).toBe('확인 필요');
  });

  it('문장 안에 낱말이 들어 있기만 하면 맞지 않는다', () => {
    expect(lookup('이 거래는 확인 필요입니다')).toBeNull();
    expect(lookup('')).toBeNull();
  });
});
