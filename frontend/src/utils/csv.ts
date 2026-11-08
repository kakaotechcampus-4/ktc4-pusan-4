import { categoryLabel, merchantTitle } from '../components/results/display';
import { answerLabel } from '../components/questions/logic';
import type { Judgment, JudgmentExportRow, LimitYear } from '../types/domain';
import { formatWon } from './format';
import { limitsOf } from './limit';
import { statuteTitle } from './statute';

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
'카테고리',
'금액',
'할부 개월',
'판정',
'계정과목',
'경비 가능 금액',
'직접 수정',
'세무사에게 넘김',
'근거 조문',
'사용 목적 등 답한 내용'];


/**
 * 근거 조문 칸 (C42). 내보내기의 Citation 은 statuteVersionId 와 statuteId 뿐이고 제목이 없다(docs/api.md).
 * 행마다 조문을 따로 읽지 않고 법령 이름도 id 에서 읽는다(소득세법시행령 → 소득세법 시행령).
 * 조를 읽지 못하는 id(심판례 등)는 그대로 둔다
 */
const citationTitle = (statuteId: string) => {
  const law = statuteId.split(/[#-]/)[0].replace(/(시행령|시행규칙)$/, ' $1');
  const title = statuteTitle(statuteId, law);
  return title === law ? statuteId : title;
};

/**
 * 내보내기 API 가 없는 서버에서 판정 목록으로 같은 모양을 만든다. 경비 가능 금액은 한도(접대비)를 반영하지 않은
 * finalAmount 이고, 답한 내용은 비어 있다
 */
export const exportRowOf = (judgment: Judgment): JudgmentExportRow => ({
  judgment,
  allowedAmount: judgment.verdict.code === 'AVAILABLE' ? judgment.finalAmount ?? 0 : 0,
  answers: []
});

/**
 * 세무사에게 넘길 CSV (2026-10-05 협업 미팅의 칸: 상품 이름, 판정 결과, 근거 조문, 사용 목적, 사용 날짜).
 * 데이터는 GET /judgments/export 가 주고 파일 변환은 FE 가 한다(#214). 엑셀이 한글을 깨뜨리지 않게 BOM 을 붙인다.
 * 한도를 넘은 해의 접대비는 서버가 경비 가능 금액을 비워 주므로(#226), 그해 초과액을 표 아래 한 줄로 적는다
 */
export function judgmentsCsv(rows: JudgmentExportRow[], limits: LimitYear[]): string {
  // 서버(computedAt DESC)·목업·판정 목록 대체 경로가 순서를 다르게 준다. 파일은 늘 승인일 순이다
  const ordered = [...rows].sort((a, b) => a.judgment.transaction.approvedAt.localeCompare(b.judgment.transaction.approvedAt));
  const body = ordered.map(({ judgment, allowedAmount, answers }) => [
  // 스프레드시트가 날짜로 읽도록 ISO 날짜로 쓴다
  judgment.transaction.approvedAt.slice(0, 10),
  // 화면과 같은 이름이다. 붙여 쓴 정규화 이름은 사람이 읽을 이름이 아니고, 가린 의료기관과 합산 행은 화면 이름으로 쓴다 (Q7, C32).
  // 카드에 찍힌 이름을 따로 두지 않는다. 같은 값이거나 가린 토큰이라 옮길 것이 없다
  merchantTitle(judgment.transaction),
  categoryLabel(judgment.transaction.merchantCategory),
  judgment.transaction.amount,
  judgment.transaction.installmentMonths,
  judgment.verdict.label,
  judgment.account,
  // 「확인 필요」는 아직 금액을 정하지 않았다. 0 이면 세무사가 「인정 안 됨」으로 읽으니 비워 둔다(#214 리뷰).
  // 한도를 넘은 해의 접대비는 서버가 null 을 준다(#226)
  judgment.verdict.code === 'NEEDS_REVIEW' ? null : allowedAmount,
  judgment.origin.type === 'OVERRIDE' ? '예' : '',
  judgment.outOfScope ? '예' : '',
  judgment.citations.map((citation) => citationTitle(citation.statuteId)).join(', '),
  // 답은 화면의 선택지 이름으로 쓴다(개인 → 개인 용도)
  answers.map((item) => `${item.question}: ${answerLabel(item.answer)}`).join(' / ')]
  );
  const exceeded = limitsOf(limits).filter((item) => item.excessAmount > 0);
  // 빈 줄로 표와 떼어, 표만 골라 합계를 내도 섞이지 않게 한다
  const notes = exceeded.length > 0 ?
  [
  [],
  ...exceeded.map(({ taxYear, totalAmount, excessAmount }) => [
  `${taxYear}년 접대비 총 ${formatWon(totalAmount)} 중 ${formatWon(excessAmount)}은 한도를 넘어 필요경비에 넣지 않습니다(직전연도 수입금액 기준 잠정). 거래별로 나눌 수 없어 이 해 가능 접대비 행의 경비 가능 금액은 비웠습니다(승인취소와 환불 행은 빼고).`]
  )] :

  [];
  return `\uFEFF${toCsv([HEADER, ...body, ...notes])}`;
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
