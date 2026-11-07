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

const KST = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

/**
 * 시각(1.2)을 KST 날짜(`YYYY-MM-DD`)와 `HH:mm` 으로 나눈다. 문자열을 잘라 쓰면 offset 을 무시해,
 * 서버가 `Z` 로 주면 9시간 이르게 보이고 자정 근처는 날짜가 하루 어긋난다.
 * 소수 초는 밀리초까지만 남긴다. 서버는 마이크로초까지 주는데, 그보다 긴 소수를 못 읽는 브라우저가 있다
 */
export const toKst = (iso: string): { date: string; time: string } => {
  const parts = Object.fromEntries(
    KST.formatToParts(new Date(iso.replace(/(\.\d{3})\d+/, '$1'))).map(({ type, value }) => [type, value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`
  };
};

export const formatDateTime = (iso: string): string => {
  const { date, time } = toKst(iso);
  return `${date} ${time}`;
};

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

/**
 * 카드사 이름. 서버는 '국민'·'기업'만 주고 화면마다 뒤에 「카드」를 붙여 써서
 * 「기업카드」가 법인카드처럼 읽혔다(치오 UX 감사 C92). 파서 코드(kb·ibk)도 같은 이름으로 모은다.
 * 사용자가 카드사 홈페이지에서 찾을 이름과 같아야 해서 줄이지 않는다
 */
const ISSUER_LABEL: Record<string, string> = {
  국민: 'KB국민카드',
  kb: 'KB국민카드',
  기업: 'IBK기업은행 카드',
  ibk: 'IBK기업은행 카드'
};

export const issuerLabel = (issuer: string): string => ISSUER_LABEL[issuer] ?? `${issuer}카드`;
