import { describe, expect, it } from 'vitest';
import { documentTitle } from './useDocumentTitle';

describe('documentTitle', () => {
  it('화면 이름 뒤에 서비스 이름을 - 로 붙인다', () => {
    expect(documentTitle('결과')).toBe('결과 - PreeT');
  });

  it('제목이 없으면 서비스 이름만, PreeT 로 시작하면 그대로 둔다', () => {
    expect(documentTitle(null)).toBe('PreeT');
    expect(documentTitle('PreeT - 개인 사업자 종합소득세 경비 판정')).toBe('PreeT - 개인 사업자 종합소득세 경비 판정');
  });
});
