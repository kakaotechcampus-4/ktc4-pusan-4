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