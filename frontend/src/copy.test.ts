import { describe, expect, it } from 'vitest';
import { DISCLAIMER, uploadName } from './copy';

describe('copy', () => {
  it('업로드 이름은 서버 값과 파서 값 어느 쪽이든 같다', () => {
    expect(uploadName({ cardIssuer: '국민', sourceType: '승인내역' })).toBe('KB국민카드 승인내역');
    expect(uploadName({ cardIssuer: 'kb', sourceType: '승인내역' })).toBe('KB국민카드 승인내역');
    expect(uploadName({ cardIssuer: '기업', sourceType: '승인내역' })).toBe('IBK기업은행 승인내역');
    expect(uploadName({ cardIssuer: 'ibk', sourceType: '청구내역' })).toBe('IBK기업은행 청구내역');
  });

  it('고지 문장은 한 문장이고 가운뎃점과 낫표가 없다', () => {
    expect(DISCLAIMER).not.toMatch(/[·・•「」『』]/);
    expect(DISCLAIMER.match(/다\./g)).toHaveLength(1);
    expect(DISCLAIMER).toContain('세무사');
  });
});
