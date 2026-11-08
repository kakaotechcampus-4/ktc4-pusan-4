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
  /** 서비스 안에서 보내려다 못 보낸 글. 첫 칸에 옮긴다 */
  message?: string;
  /** 마지막 오류 응답의 traceId (#225) */
  traceId?: string;
}

/**
 * 신고에 적어 주면 좋은 것 (#211). /bug-report 화면이 보여 주고, 메일 본문도 앞 셋을 칸으로 둔다.
 * 「언제」는 메일 본문에 자동으로 채운다
 */
export const WHAT_TO_WRITE = [
{ term: '무엇을 하려다', detail: '어느 화면에서 어떤 버튼을 눌렀는지' },
{ term: '무엇을 봤는지', detail: '화면에 뜬 문구 그대로. 숫자가 안 맞으면 양쪽 숫자를 함께' },
{ term: '무엇을 기대했는지', detail: '대신 어떻게 나왔어야 하는지' },
{ term: '언제', detail: '날짜와 대략의 시각' }];


/** 글을 n 자로 자른다. 이모지 같은 두 칸 글자를 반으로 가르면 encodeURIComponent 가 URIError 를 던진다 */
export const cutText = (text: string, n: number) => text.slice(0, n).replace(/[\uD800-\uDBFF]$/, '');

const body = (context: BugContext, userAgent: string, message: string) =>
[
...(message ?
[message, '', ''] :
WHAT_TO_WRITE.slice(0, 3).flatMap((item) => [`${item.term}:`, '', ''])),
'---',
'아래는 자동으로 채운 정보입니다. 지워도 됩니다.',
`화면: ${context.path}`,
`시각: ${formatDateTime(context.at)} (KST)`,
`브라우저: ${userAgent}`,
`계정 id: ${context.userId ?? '로그인 전'}`,
...(context.traceId ? [`trace id: ${context.traceId}`] : [])].
join('\n');

/**
 * 버그 신고 메일 링크. 제목과 본문을 미리 채운다. 길이가 넘치면 브라우저 정보부터 줄이고, 그래도 넘치면 적은 글 끝을 줄인다
 */
export function bugReportMailto(context: BugContext): string {
  const subject = `[PreeT 버그 신고] ${context.path}`;
  const build = (userAgent: string, message: string) =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body(context, userAgent, message))}`;
  let userAgent = context.userAgent;
  const message = context.message ?? '';
  let href = build(userAgent, message);
  while (href.length > MAILTO_LIMIT && userAgent.length > 0) {
    userAgent = userAgent.slice(0, Math.max(0, userAgent.length - 40));
    href = build(userAgent, message);
  }
  // 줄인 글은 끝에 줄였다고 적는다
  let kept = message.length;
  while (href.length > MAILTO_LIMIT && kept > 0) {
    kept = Math.max(0, kept - 20);
    href = build(userAgent, `${cutText(message, kept)} (메일 링크 길이 때문에 뒤를 줄였습니다)`);
  }
  return href;
}
