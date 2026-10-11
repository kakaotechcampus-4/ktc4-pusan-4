export const formatWon = (amount: number): string =>
`${amount.toLocaleString('ko-KR')}원`;

export const formatNumber = (value: number): string =>
value.toLocaleString('ko-KR');

export const formatDate = (iso: string): string => {
  const [, month, day] = iso.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
};

export const formatFullDate = (iso: string): string => {
  const [year, month, day] = iso.split('-');
  return `${year}. ${month}. ${day}`;
};

export const formatPeriod = (start: string, end: string): string =>
`${formatFullDate(start)} – ${formatFullDate(end)}`;

/** 숫자는 읽는 소리로 정한다. 영·삼·육은 받침이 있고, 일·칠·팔은 ㄹ 받침이라 「로」 */
const DIGIT_RO: Record<string, '로' | '으로'> = {
  '0': '으로', '1': '로', '2': '로', '3': '으로', '4': '로',
  '5': '로', '6': '으로', '7': '로', '8': '로', '9': '로'
};

/**
 * 낱말 뒤에 붙일 「로」·「으로」. 받침이 있으면(ㄹ 제외) 「으로」 — 가능으로, 불가로, 「개인」으로.
 * 숫자로 끝나면 읽는 소리로(「3」으로, 「20」으로, 「1」로), % 는 「퍼센트」로 읽어 「로」. 그 밖의 글자는 「로」.
 */
export const ro = (word: string): '로' | '으로' => {
  const lastChar = word.trim().slice(-1);
  if (lastChar in DIGIT_RO) return DIGIT_RO[lastChar];
  const last = lastChar.charCodeAt(0) - 0xac00;
  const coda = last >= 0 && last < 11172 ? last % 28 : 0;
  return coda === 0 || coda === 8 ? '로' : '으로';
};
