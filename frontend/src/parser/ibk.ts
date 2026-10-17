import { CANCEL_MARK, makeRecord, normBizno, parseAmount, parseDate, parseInstallment } from './primitives';
import type { AdapterResult, RawRecord } from './types';

/**
 * IBK형 — 확장자만 .xls 이고 실제 내용은 HTML 표다. tools/parsers/ibk.py 를 옮겼다.
 * 실제 파일에는 colspan="5.5" 같은 값이 있어 표 라이브러리 대신 tr/td 를 직접 읽는다.
 * 데이터 행 판별: td 11개 이상 + 첫 셀이 숫자.
 */

const COL = {
  no: 0,
  approvalKind: 1, // 승인구분. 취소는 음수 금액이 아니라 '취소또는할인' 으로 온다
  usage: 2, // 이용구분. 'N개월' 이면 할부
  approvedAt: 3, // 승인일시. 날짜만 쓰고 시각은 버린다
  merchant: 5, // 이용가맹점명
  amount: 6, // 승인금액
  approvalNo: 8, // 승인번호
  bizNo: 10 // 가맹점사업자번호
};
const MIN_TD = 11;

export function decodeIbk(bytes: ArrayBuffer): string {
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * BeautifulSoup get_text(' ', strip=True) 와 같다. 글자 조각마다 앞뒤 공백을 떼고,
 * 빈 조각은 버리고, 한 칸 띄어 잇는다. textContent 는 <br> 양쪽을 붙여 버린다.
 */
export function bsText(element: Element): string {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest('script, style')) continue;
    const text = (node.nodeValue ?? '').trim();
    if (text) parts.push(text);
  }
  return parts.join(' ');
}

/** th 가 가장 많은 행이 헤더다. 개수가 같으면 먼저 나온 행을 쓴다 */
export function ibkHeaders(doc: Document): string[] {
  let best: NodeListOf<HTMLTableCellElement> | null = null;
  for (const tr of Array.from(doc.querySelectorAll('tr'))) {
    const ths = tr.querySelectorAll('th');
    if (ths.length > (best?.length ?? 0)) best = ths;
  }
  return best ? Array.from(best, bsText) : [];
}

export function ibkRecords(doc: Document): Omit<AdapterResult, 'headers' | 'declaredPeriod'> {
  const records: RawRecord[] = [];
  let sourceRows = 0;
  for (const tr of Array.from(doc.querySelectorAll('tr'))) {
    const tds = tr.querySelectorAll('td');
    if (tds.length < MIN_TD) continue;
    const cells = Array.from(tds, bsText);
    if (!/^\d+$/.test(cells[COL.no])) continue;
    sourceRows++;
    const approvalKind = cells[COL.approvalKind];
    const usage = cells[COL.usage];
    records.push(makeRecord({
      merchant: cells[COL.merchant],
      amount: parseAmount(cells[COL.amount]),
      bizNo: normBizno(cells[COL.bizNo]),
      memo: '',
      source: 'ibk',
      approvalNo: cells[COL.approvalNo],
      when: parseDate(cells[COL.approvedAt]),
      installment: parseInstallment(usage),
      isCancel: approvalKind.includes(CANCEL_MARK) || usage.includes(CANCEL_MARK)
    }));
  }
  // IBK 는 원화 금액만 준다
  return { records, sourceRows, foreignOnlySkipped: 0 };
}

/** 파일 하나를 한 번만 파싱한다. DOMParser 가 있어야 해서 메인 스레드에서 돈다 */
export function readIbk(html: string): AdapterResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // IBK 파일에는 조회기간이 없다
  return { headers: ibkHeaders(doc), ...ibkRecords(doc), declaredPeriod: null };
}
