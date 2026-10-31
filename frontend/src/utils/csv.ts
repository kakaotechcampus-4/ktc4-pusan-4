import type { Judgment, JudgmentExportRow } from '../types/domain';

/** 쉼표·따옴표·줄바꿈이 든 칸만 따옴표로 감싼다 (RFC 4180). 수식으로 읽힐 칸은 앞에 ' 를 붙여 막는다 */
const cell = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (rows: (string | number | null | undefined)[][]) => rows.map((row) => row.map(cell).join(',')).join('\r\n');

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
'근거 조문',
'사용 목적 등 답한 내용'];


/** 내보내기 API 가 없는 서버에서 판정 목록으로 같은 모양을 만든다. 한도 반영 금액과 답은 비어 있다 */
export const exportRowOf = (judgment: Judgment): JudgmentExportRow => ({
  judgment,
  allowedAmount: judgment.verdict.code === 'AVAILABLE' ? judgment.finalAmount ?? 0 : 0,
  answers: []
});

/**
 * 세무사에게 넘길 CSV (2026-10-05 협업 미팅의 칸: 상품 이름, 판정 결과, 근거 조문, 사용 목적, 사용 날짜).
 * 데이터는 GET /judgments/export 가 주고 파일 변환은 FE 가 한다(#214). 엑셀이 한글을 깨뜨리지 않게 BOM 을 붙인다
 */
export function judgmentsCsv(rows: JudgmentExportRow[]): string {
  const body = rows.map(({ judgment, allowedAmount, answers }) => [
  // 스프레드시트가 날짜로 읽도록 ISO 날짜로 쓴다
  judgment.transaction.approvedAt.slice(0, 10),
  judgment.transaction.merchantNorm,
  judgment.transaction.merchantRaw,
  judgment.transaction.merchantCategory,
  judgment.transaction.amount,
  judgment.transaction.installmentMonths,
  judgment.verdict.label,
  allowedAmount,
  judgment.origin.type === 'OVERRIDE' ? '예' : '',
  judgment.outOfScope ? '예' : '',
  judgment.citations.map((citation) => citation.statuteId).join(' '),
  answers.map((item) => `${item.question} → ${item.answer}`).join(' / ')]
  );
  return `\uFEFF${toCsv([HEADER, ...body])}`;
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
