import { loadXlsx } from './kb';

/**
 * 테스트와 목업 모드 「샘플 파일로 해 보기」에 쓰는 카드내역 파일. 값은 모두 가짜다.
 * 저장소가 공개라 실제 파일은 넣지 않고, 실제 파일과 같은 모양을 메모리에서 만든다.
 * 행마다 노리는 규칙은 계획서의 Fixtures 표와 같다 — 행을 바꾸면 파이프라인 · 요청 테스트의 합계가 바뀐다.
 */

export type KbSample = 'full' | 'noSummary' | 'billing' | 'empty';
export type IbkSample = 'full' | 'billing' | 'noHeader';

export interface SampleFile {
  id: string;
  label: string;
  file: File;
}

type Row = (string | number | null)[];

const KB_SUMMARY: Row[] = [
  [],
  ['조회기간', '2026-01-01 ~ 2026-03-31'],
  ['카드구분', '전체'],
  ['이용구분', '전체'],
  ['조회일시', '2026-04-01 09:00'],
  []
];

/** 6행. 실제 파일처럼 줄바꿈이 섞여 있고, 메모 칸(14)에는 헤더가 없다 */
const KB_HEADERS: Row = [
  '이용일', '이용\n시간', '이용고객명', '이용카드명', '이용하신곳', '국내이용금액\n(원)', '해외이용금액\n($)',
  '결제방법', '가맹점\n정보', '할인금액', '적립(예상)\n포인트리', '상태', '결제예정일', '승인번호'];

/** 이용일 · 가맹점 · 국내 · 해외 · 결제방법 · 상태 · 승인번호 · 메모만 다르고 나머지 칸은 같다 */
function kbRow(
  date: string | number,
  merchant: string,
  domestic: number,
  approvalNo: string,
  { foreign = 0, payment = '일시불', status = '전표매입', memo = null as string | null } = {}
): Row {
  return [
    date, '12:30', '홍길동', 'KB국민 테스트카드', merchant, domestic, foreign, payment, null, 0, 0, status, '2026-04-25',
    approvalNo, memo
  ];
}

/** 7~22행 */
const KB_ROWS: Row[] = [
  kbRow('2026-01-03', '스타벅스코리아 서면점', 11000, '78968731', { memo: 'Onedrive' }),
  kbRow('2026-01-05', '서면연세의원', 15000, '10000002', { memo: '진료' }),
  kbRow('2026-01-06', '부산약국', 4500, '10000003', { payment: '포인트리' }),
  kbRow('2026-01-09', '서면연세의원', 15000, '10000004'),
  kbRow('2026-01-10', '쿠팡', 39000, '20000008'),
  kbRow('2026-01-12', '쿠팡', -39000, '20000009', { status: '취소전표매입' }),
  kbRow('2026-01-13', 'AWS', 0, '20000010', { foreign: 12.5 }),
  kbRow('2026-01-15', '교보문고', 22000, '30000001'),
  kbRow('2026-02-03', '하이마트', 360000, '30000002', { payment: '3개월' }),
  kbRow('2026-02-10', '지하철_모바일 50 건', 62500, '30000003'),
  kbRow(46040, 'GS25 서면점', 3000, '30000004'),
  kbRow('2026-02-20', '포인트사용', -1000, '30000005'),
  kbRow('2026-02-21', '다이소 서면점', 0, '30000006'),
  [],
  kbRow('2026-03-02', ' ', 5000, '30000007'),
  kbRow('2026-03-31', '넷플릭스', 13500, '30000008', { memo: 'GPT' })];

const KB_BILLING_HEADERS: Row = ['청구일', '카드번호', '청구금액', '청구원금', '결제원금', '잔여할부', '할부수수료'];
const KB_BILLING_ROWS: Row[] = [
  ['2026-02-25', '1234-56**-****-7890', 120000, 120000, 120000, 0, 0],
  ['2026-02-25', '1234-56**-****-7890', 30000, 29000, 29000, 2, 1000]];

function kbSheetRows(variant: KbSample): Row[] {
  switch (variant) {
    case 'full':
      return [...KB_SUMMARY, KB_HEADERS, ...KB_ROWS];
    case 'noSummary':
      return [[], [], [], [], [], [], KB_HEADERS, ...KB_ROWS];
    case 'billing':
      return [...KB_SUMMARY, KB_BILLING_HEADERS, ...KB_BILLING_ROWS];
    case 'empty':
      // 조회 결과가 없어 요약만 있는 파일
      return KB_SUMMARY.slice(0, 5);
  }
}

/** KB 승인내역 모양의 BIFF8 .xls (OLE). xlrd 로도 읽힌다 */
export async function buildKbXls(variant: KbSample = 'full'): Promise<ArrayBuffer> {
  const xlsx = await loadXlsx();
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet(kbSheetRows(variant)), '국내이용내역');
  return xlsx.write(book, { bookType: 'biff8', type: 'array' }) as ArrayBuffer;
}

const IBK_HEADERS = [
  'No', '승인구분', '이용구분', '승인일시', '카드번호', '이용가맹점명', '승인금액', '제휴카드명', '승인번호', '매출표<br>접수일자',
  '가맹점<br>사업자번호'];

const IBK_BILLING_HEADERS = [
  'No', '청구일', '카드번호', '이용일', '청구금액', '청구원금', '결제원금', '잔여할부', '할부수수료', '이자', '비고'];

/** 승인구분 · 이용구분 · 승인일시 · 가맹점 · 승인금액 · 승인번호 · 사업자번호. 셀 안은 HTML 그대로 들어간다 */
type IbkRow = [string, string, string, string, string, string, string];

/** 1~22행 */
const IBK_ROWS: IbkRow[] = [
  ['승인', '국내일시불', '2026-01-03 12:30:15', '스타벅스코리아<br>서면점', '11,000', '78968731', '220-81-00001'],
  ['취소또는할인', '국내일시불', '2026-01-04 08:10:00', '편의점할인', '500', 'A0000002', ''],
  ['취소또는할인', '국내일시불', '2026-01-05 10:00:00', '행복할인', '1,000', 'A0000003', '2208212345'],
  ['승인', '국내일시불', '2026-01-07 19:20:00', '쿠팡', '25,000', '40000004', '120-88-00767'],
  ['취소또는할인', '국내일시불', '2026-01-08 09:00:00', '쿠팡', '25,000', '40000004', '120-88-00767'],
  ['승인', '국내일시불', '2026-01-10 07:00:00', '구글플레이', '4,400', '50000006', ''],
  ['승인', '국내일시불', '2026-02-10 07:00:00', '구글플레이', '4,400', '50000007', ''],
  ['취소또는할인', '국내일시불', '2026-02-12 07:00:00', '구글플레이', '4,400', '50000008', ''],
  ['취소또는할인', '국내일시불', '2026-01-20 21:00:00', '넷플릭스', '13,500', '60000009', ''],
  ['승인', '국내일시불', '2026-01-31 23:59:00', '버스_모바일 3 건', '4,500', '70000010', ''],
  ['취소또는할인', '국내일시불', '2026-02-01 23:59:00', '버스_모바일 3 건', '4,500', '70000011', ''],
  ['승인', '국내일시불', '2026-01-02 15:00:00', '교보문고', '18,000', '80000012', '102-81-00012'],
  ['취소또는할인', '국내일시불', '2026-03-05 15:00:00', '교보문고', '18,000', '80000013', '102-81-00012'],
  ['승인', '국내일시불', '2026-01-01 11:00:00', '알라딘', '15,000', '90000014', '201-81-00014'],
  ['취소또는할인', '국내일시불', '2026-03-05 11:00:00', '알라딘', '15,000', '90000015', '201-81-00014'],
  ['승인', '국내할부(3개월)', '2026-02-14 13:00:00', '하이마트', '1,200,000', 'B0000016', '123 45 67891'],
  ['승인', '국내일시불', '2026-02-20 10:30:00', '해운대치과의원', '30,000', 'B0000017', '6178100017'],
  ['승인', '국내일시불', '2026-02-27 10:30:00', '해운대치과', '20,000', 'B0000018', '6178100017'],
  ['승인', '국내일시불', '', 'GS25 해운대점', '3,000', 'B0000019', ''],
  ['승인', '국내일시불', '2025-12-31 18:00:00', '', '7,000', 'B0000020', ''],
  ['승인', '국내일시불', '2026-02-28 18:00:00', '이마트24 센텀점', '', 'B0000021', ''],
  ['승인', '국내일시불', '2026-03-01 12:00:00', '쿠팡이츠', '21,000', 'B0000022', '12-345-67890']];

const IBK_BILLING_ROWS: string[][] = [
  ['1', '2026-02-25', '1234-56**-****-7890', '2026-01-10', '120,000', '120,000', '120,000', '0', '0', '0', ''],
  ['2', '2026-02-25', '1234-56**-****-7890', '2026-01-15', '30,000', '29,000', '29,000', '2', '1,000', '0', '']];

function ibkDataRow(no: number, [kind, usage, at, merchant, amount, approvalNo, bizNo]: IbkRow): string[] {
  const receivedAt = at.slice(0, 10);
  return [String(no), kind, usage, at, '1234-56**-****-7890', merchant, amount, 'IBK 테스트카드', approvalNo, receivedAt, bizNo];
}

const tr = (tag: 'th' | 'td', cells: string[]) => `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join('')}</tr>`;

/**
 * IBK 승인내역 모양의 HTML. 실제 파일처럼 <head> 의 스타일 뒤에 표가 오고,
 * 제목 행(colspan="5.5"), 합계 행, th 11개 헤더 순서다.
 */
export function buildIbkHtml(variant: IbkSample = 'full'): string {
  const billing = variant === 'billing';
  const header = billing ? IBK_BILLING_HEADERS : IBK_HEADERS;
  const rows = billing ? IBK_BILLING_ROWS : IBK_ROWS.map((row, i) => ibkDataRow(i + 1, row));
  const style = ['th', 'td', '.title', '.total']
    .map((sel) => `${sel} { font-family: '맑은 고딕', sans-serif; font-size: 9pt; border: 0.5pt solid #000000; mso-number-format: '\\@'; }`)
    .join('\n');
  return [
    '<html>',
    '<head>',
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">',
    `<style>\n${style}\n</style>`,
    '</head>',
    '<body>',
    '<table border="1">',
    `<tr><th colspan="5.5" class="title">${billing ? '기간별 청구내역 조회' : '기간별 사용내역 조회'}</th></tr>`,
    `<tr><th class="total">합계</th><td colspan="4">${rows.length}건</td><td colspan="6"></td></tr>`,
    ...(variant === 'noHeader' ? [] : [tr('th', header)]),
    ...rows.map((row) => tr('td', row)),
    '</table>',
    '</body>',
    '</html>'
  ].join('\n');
}

/** 목업 모드의 「샘플 파일로 해 보기」. 가짜 거래로 만든 파일이다 */
export async function sampleFiles(): Promise<SampleFile[]> {
  const type = 'application/vnd.ms-excel';
  return [
    { id: 'kb', label: 'KB국민 승인내역', file: new File([await buildKbXls('full')], 'kb_sample.xls', { type }) },
    { id: 'ibk', label: 'IBK기업 승인내역', file: new File([buildIbkHtml('full')], 'ibk_sample.xls', { type }) },
    { id: 'billing', label: 'KB국민 청구내역', file: new File([await buildKbXls('billing')], 'kb_billing_sample.xls', { type }) }
  ];
}
