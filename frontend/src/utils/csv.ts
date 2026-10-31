import type { Judgment } from '../types/domain';

/** 쉼표·따옴표·줄바꿈이 든 칸만 따옴표로 감싼다 (RFC 4180). 수식으로 읽힐 칸은 앞에 ' 를 붙여 막는다 */
const cell = (value: string | number | null) => {
  if (value === null) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (rows: (string | number | null)[][]) => rows.map((row) => row.map(cell).join(',')).join('\r\n');

const HEADER = [
'승인일',
'가맹점',
'원래 가맹점명',
'카테고리',
'금액',
'할부 개월',
'판정',
'인정 금액',
'직접 수정',
'세무사에게 넘김',
'근거 조문'];


/** 판정 결과 CSV. 엑셀이 한글을 깨뜨리지 않게 BOM 을 붙인다 */
export function judgmentsCsv(judgments: Judgment[]): string {
  const rows = judgments.map((row) => [
  // 스프레드시트가 날짜로 읽도록 ISO 날짜로 쓴다
  row.transaction.approvedAt.slice(0, 10),
  row.transaction.merchantNorm,
  row.transaction.merchantRaw,
  row.transaction.merchantCategory,
  row.transaction.amount,
  row.transaction.installmentMonths,
  row.verdict.label,
  row.finalAmount,
  row.origin.type === 'OVERRIDE' ? '예' : '',
  row.outOfScope ? '예' : '',
  row.citations.map((citation) => citation.statuteId).join(' ')]
  );
  return `\uFEFF${toCsv([HEADER, ...rows])}`;
}

/** 브라우저에서 파일로 내려받는다 */
export function download(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
