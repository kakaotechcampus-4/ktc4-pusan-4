import { describe, expect, it } from 'vitest';
import { bugReportMailto, MAILTO_LIMIT } from './bugReport';
import { SUPPORT_EMAIL } from './contact';

const base = {
  path: '/results',
  at: '2026-10-31T11:40:00Z',
  userAgent: 'Mozilla/5.0 (Macintosh) Chrome/130',
  userId: 'u-1'
};

describe('bugReportMailto', () => {
  it('받는 주소·제목·본문을 채우고 이메일은 넣지 않는다', () => {
    const href = bugReportMailto(base);
    expect(href.startsWith(`mailto:${SUPPORT_EMAIL}?`)).toBe(true);
    const params = new URLSearchParams(href.slice(href.indexOf('?') + 1));
    expect(params.get('subject')).toBe('[PreeT 버그 신고] /results');
    const text = params.get('body') ?? '';
    expect(text).toContain('무엇을 하려다:');
    expect(text).toContain('무엇을 기대했는지:');
    expect(text).toContain('화면: /results');
    expect(text).toContain('시각: 2026. 10. 31 20:40 (KST)');
    expect(text).toContain('계정 id: u-1');
    expect(text).not.toMatch(/@/);
  });

  it('길이가 넘치면 브라우저 정보를 줄여 2,000자 안에 맞춘다', () => {
    const href = bugReportMailto({ ...base, userAgent: 'x'.repeat(3000) });
    expect(href.length).toBeLessThanOrEqual(MAILTO_LIMIT);
    expect(href).toContain(encodeURIComponent('화면: /results'));
  });
});
