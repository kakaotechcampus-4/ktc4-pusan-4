import type { WorkSheet } from 'xlsx';
import { CANCEL_MARK, ParserError, cellText, makeRecord, parseAmount, parseDate, parseInstallment } from './primitives';
import { detectFormat } from './detect';
import type { AdapterResult, Cell, Grid, RawRecord } from './types';

/**
 * KB형 — 진짜 바이너리 xls(CDFV2). tools/parsers/kb.py 를 옮겼다.
 * 0~5행은 요약 정보, 6행이 헤더, 7행부터 데이터다. 0행과 5행은 비어 있을 수 있어서
 * 셀은 늘 절대 주소로 읽는다. 15번째 컬럼(인덱스 14)은 헤더가 비어 있는 사용자 메모다.
 */

export type XlsxModule = typeof import('xlsx');

let xlsxModule: Promise<XlsxModule> | null = null;

/** SheetJS 는 업로드 화면에서만 필요하다. 처음 쓸 때 불러온다 */
export function loadXlsx(): Promise<XlsxModule> {
  if (!xlsxModule) {
    xlsxModule = import('xlsx').catch((error: unknown) => {
      // 불러오기에 실패하면 다음 시도에서 다시 불러온다
      xlsxModule = null;
      throw error;
    });
  }
  return xlsxModule;
}

const HEADER_ROW = 6;
const COL = {
  date: 0, // 이용일. 페어링과 natural_key 에 쓴다
  merchant: 4, // 이용하신곳
  domestic: 5, // 국내이용금액
  foreign: 6, // 해외이용금액
  payment: 7, // 결제방법
  status: 11, // 상태. '취소전표매입' 이면 취소다
  approval: 13, // 승인번호
  memo: 14 // 헤더 없는 사용자 메모
};

/**
 * 시트를 절대 주소 격자로 본다. 크기는 !ref 가 아니라 실제 셀 주소에서 잡는다.
 * 값은 .v 만 쓴다 — .w 는 표시 형식이 입혀진 문자열이라 원본 값이 아니다.
 */
export function gridFromSheet(xlsx: XlsxModule, sheet: WorkSheet): Grid {
  let nrows = 0;
  let ncols = 0;
  for (const address of Object.keys(sheet)) {
    if (address.charAt(0) === '!') continue;
    const { r, c } = xlsx.utils.decode_cell(address);
    nrows = Math.max(nrows, r + 1);
    ncols = Math.max(ncols, c + 1);
  }
  return {
    nrows,
    ncols,
    cell(r: number, c: number): Cell {
      const value: unknown = sheet[xlsx.utils.encode_cell({ r, c })]?.v;
      // cellDates: false 라 Date 는 오지 않는다
      return typeof value === 'object' ? undefined : value as Cell;
    }
  };
}

/** 6행이 헤더다. 승인내역/청구내역 판별에 쓴다 */
export function kbHeaders(grid: Grid): string[] {
  if (grid.nrows <= HEADER_ROW) return [];
  return Array.from({ length: grid.ncols }, (_, c) => cellText(grid.cell(HEADER_ROW, c)));
}

export function kbRecords(grid: Grid): Omit<AdapterResult, 'headers' | 'declaredPeriod'> {
  const records: RawRecord[] = [];
  let sourceRows = 0;
  let foreignOnlySkipped = 0;
  for (let r = HEADER_ROW + 1; r < grid.nrows; r++) {
    const merchant = cellText(grid.cell(r, COL.merchant)).trim();
    if (!merchant) continue;
    sourceRows++;

    const domestic = parseAmount(grid.cell(r, COL.domestic)) ?? 0;
    const foreign = parseAmount(grid.cell(r, COL.foreign)) ?? 0;
    if (domestic === 0 && foreign !== 0) {
      // 외화 전용 행. 원화 환산액이 없어 그대로 넣으면 단위가 섞인다
      foreignOnlySkipped++;
      continue;
    }

    records.push(makeRecord({
      merchant,
      amount: domestic === 0 ? null : domestic,
      bizNo: '', // KB 파일에는 가맹점 사업자번호가 없다
      memo: cellText(grid.cell(r, COL.memo)).trim(),
      source: 'kb',
      approvalNo: grid.cell(r, COL.approval),
      when: parseDate(grid.cell(r, COL.date)),
      installment: parseInstallment(grid.cell(r, COL.payment)),
      isCancel: cellText(grid.cell(r, COL.status)).includes(CANCEL_MARK)
    }));
  }
  return { records, sourceRows, foreignOnlySkipped };
}

const PERIOD_RE = /(\d{4}[-.]\d{1,2}[-.]\d{1,2})\s*~\s*(\d{4}[-.]\d{1,2}[-.]\d{1,2})/;

/** 요약 영역(0~5행)의 「조회기간」 오른쪽 칸. 사용자가 실제로 내려받은 기간이다 */
export function kbDeclaredPeriod(grid: Grid): AdapterResult['declaredPeriod'] {
  for (let r = 0; r < Math.min(HEADER_ROW, grid.nrows); r++) {
    for (let c = 0; c < grid.ncols; c++) {
      if (cellText(grid.cell(r, c)).replace(/\s/g, '') !== '조회기간') continue;
      for (let next = c + 1; next < grid.ncols; next++) {
        const text = cellText(grid.cell(r, next)).trim();
        if (!text) continue;
        const match = PERIOD_RE.exec(text);
        const start = match && parseDate(match[1]);
        const end = match && parseDate(match[2]);
        return start && end ? { start, end } : null;
      }
      return null;
    }
  }
  return null;
}

export async function readKb(bytes: ArrayBuffer): Promise<AdapterResult> {
  // SheetJS 는 HTML · CSV 도 표로 읽어 버린다. KB 는 OLE 파일만 받는다
  const view = new Uint8Array(bytes);
  if (detectFormat(view) !== 'kb') {
    throw new ParserError('KB_READ', 'KB 파일이 아닙니다.');
  }
  const xlsx = await loadXlsx();
  let sheet: WorkSheet | undefined;
  try {
    const book = xlsx.read(view, {
      type: 'array',
      cellDates: false,
      cellNF: false,
      cellText: false,
      cellHTML: false,
      cellFormula: false,
      cellStyles: false,
      sheetStubs: false,
      dense: false
    });
    sheet = book.SheetNames
      .map((name) => book.Sheets[name])
      .find((s) => s !== undefined && (s['!type'] === undefined || s['!type'] === 'sheet'));
  } catch (error) {
    throw new ParserError('KB_READ', `KB 파일을 열지 못했습니다: ${String(error)}`);
  }
  if (!sheet) throw new ParserError('KB_READ', 'KB 파일에 시트가 없습니다.');

  const grid = gridFromSheet(xlsx, sheet);
  return { headers: kbHeaders(grid), ...kbRecords(grid), declaredPeriod: kbDeclaredPeriod(grid) };
}
