/** 클래스 문자열을 이어 붙인다. falsy 값은 버린다. */
export const cn = (...parts: Array<string | false | null | undefined>) =>
parts.filter(Boolean).join(' ');
