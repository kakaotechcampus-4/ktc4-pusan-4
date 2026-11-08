import { describe, expect, it } from 'vitest';
import { passwordProblem } from './password';

describe('passwordProblem', () => {
  it('영문, 숫자, 기호가 다 있는 8~72자는 받는다', () => {
    expect(passwordProblem('abcd123!')).toBeNull();
    expect(passwordProblem('A1~' + 'a'.repeat(69))).toBeNull();
  });

  it('대문자는 필수가 아니다', () => {
    expect(passwordProblem('lower12#')).toBeNull();
  });

  it('길이가 8자 미만이거나 72자를 넘으면 막는다', () => {
    expect(passwordProblem('ab1!')).toBe('8자 이상으로 입력해 주세요.');
    expect(passwordProblem('a1!' + 'a'.repeat(70))).toBe('72자 이하로 입력해 주세요.');
  });

  it('빠진 종류를 알려 준다', () => {
    expect(passwordProblem('abcdefgh')).toBe('숫자, 기호를 하나 이상 넣어 주세요.');
    expect(passwordProblem('12345678!')).toBe('영문을 하나 이상 넣어 주세요.');
    expect(passwordProblem('abcd1234')).toBe('기호를 하나 이상 넣어 주세요.');
    expect(passwordProblem('!!!!@@@@')).toBe('영문, 숫자를 하나 이상 넣어 주세요.');
  });

  it('공백과 한글은 막는다', () => {
    expect(passwordProblem('abc 123!')).toMatch('공백이나 한글');
    expect(passwordProblem('비밀번호abc1!')).toMatch('공백이나 한글');
  });
});
