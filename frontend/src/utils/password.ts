/**
 * 새 비밀번호 규칙 (api.md 1.1 회원가입, 백엔드 Passwords.java 와 같다).
 * 영문자, 숫자, 기호를 하나씩 넣은 8~72자. 기호는 영문자와 숫자가 아닌 출력 가능한 ASCII(! 부터 ~ 까지)다.
 * 공백과 한글은 쓸 수 없다. 대문자는 필수가 아니다.
 * 로그인은 이 규칙을 보지 않는다. 규칙이 생기기 전에 가입한 비밀번호도 그대로 들어간다
 */
export const PASSWORD_RULE = '영문, 숫자, 기호를 섞어 8~72자';

/** ! 부터 ~ 까지. 공백, 한글, 그 밖의 문자는 뺀다 */
const ALLOWED = /^[!-~]*$/;
const SYMBOL = /[!-/:-@[-`{-~]/;

/** 규칙에 맞으면 null, 아니면 칸 아래에 둘 문장. 서버 문장과 뜻을 맞춘다 */
export function passwordProblem(password: string): string | null {
  if (!ALLOWED.test(password)) return '공백이나 한글은 쓸 수 없습니다. 영문, 숫자, 기호만 쓸 수 있습니다.';
  if (password.length < 8) return '8자 이상으로 입력해 주세요.';
  if (password.length > 72) return '72자 이하로 입력해 주세요.';
  const missing = [
  !/[A-Za-z]/.test(password) && '영문',
  !/[0-9]/.test(password) && '숫자',
  !SYMBOL.test(password) && '기호'].
  filter((item): item is string => typeof item === 'string');
  if (missing.length === 0) return null;
  // 영문은 받침이 있어 「을」, 숫자와 기호는 「를」
  const particle = missing.at(-1) === '영문' ? '을' : '를';
  return `${missing.join(', ')}${particle} 하나 이상 넣어 주세요.`;
}
