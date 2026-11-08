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

  it('서비스 안에서 못 보낸 글과 traceId 를 본문에 옮기고, 넘치면 글 끝을 줄인다', () => {
    const params = (href: string) => new URLSearchParams(href.slice(href.indexOf('?') + 1)).get('body') ?? '';
    const text = params(bugReportMailto({ ...base, message: '금액이 0원으로 나와요', traceId: 'tr-1' }));
    expect(text.startsWith('금액이 0원으로 나와요')).toBe(true);
    expect(text).not.toContain('무엇을 하려다:');
    expect(text).toContain('trace id: tr-1');

    const long = bugReportMailto({ ...base, message: '가'.repeat(2000) });
    expect(long.length).toBeLessThanOrEqual(MAILTO_LIMIT);
    expect(params(long)).toContain('계정 id: u-1');
    expect(params(long).split('\n')[0].endsWith('(메일 링크 길이 때문에 뒤를 줄였습니다)')).toBe(true);
    // 이모지(두 칸 글자)를 반으로 갈라도 링크를 만든다
    expect(() => bugReportMailto({ ...base, message: '😀'.repeat(300) + 'a' })).not.toThrow();
  });
});
