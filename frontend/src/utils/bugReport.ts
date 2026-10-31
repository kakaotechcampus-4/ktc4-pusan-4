import { SUPPORT_EMAIL } from './contact';
import { formatDateTime } from './format';

/** 메일 앱과 브라우저가 받아 주는 mailto 길이. 이보다 길면 잘리거나 열리지 않는다 */
export const MAILTO_LIMIT = 2000;

interface BugContext {
  /** 지금 화면 경로. 쿼리는 넣지 않는다 */
  path: string;
  /** ISO 시각 */
  at: string;
  userAgent: string;
  /** 로그인 전이면 null. 이메일은 넣지 않는다 — 보내는 사람 주소로 이미 알 수 있다 */
  userId: string | null;
}

const body = (context: BugContext, userAgent: string) =>
[
'무엇을 하다가 문제가 생겼나요?',
'',
'',
'어떻게 되기를 기대했나요?',
'',
'',
'---',
'아래는 자동으로 채운 정보입니다. 지워도 됩니다.',
`화면: ${context.path}`,
`시각: ${formatDateTime(context.at)} (KST)`,
`브라우저: ${userAgent}`,
`계정 id: ${context.userId ?? '로그인 전'}`].
join('\n');

/**
 * 버그 신고 메일 링크. 제목과 본문을 미리 채운다. 길이가 넘치면 브라우저 정보부터 줄인다
 */
export function bugReportMailto(context: BugContext): string {
  const subject = `[PreeT 버그 신고] ${context.path}`;
  const build = (userAgent: string) =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body(context, userAgent))}`;
  let userAgent = context.userAgent;
  let href = build(userAgent);
  while (href.length > MAILTO_LIMIT && userAgent.length > 0) {
    userAgent = userAgent.slice(0, Math.max(0, userAgent.length - 40));
    href = build(userAgent);
  }
  return href;
}
