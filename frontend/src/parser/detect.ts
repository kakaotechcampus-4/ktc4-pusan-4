import type { DetectedFormat, StatementCode, StatementVerdict } from './types';

/** KB 의 진짜 xls(CDFV2) 는 OLE 복합 문서로 시작한다 */
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/**
 * IBK 실제 파일은 <html 로 시작하지만 첫 <table 은 1921 바이트에 있다.
 * 앞부분만 짧게 보면 놓치므로 넉넉히 64 KiB 를 본다.
 */
const SNIFF_BYTES = 64 * 1024;

/**
 * 파일 앞부분으로 카드사 형식을 고른다. KB 는 바이너리 xls, IBK 는 HTML 표다.
 * Python 은 앞 8바이트의 '<html' 만 받는다. 여기서는 BOM · 앞 공백 · <!doctype html> ·
 * <html 로 시작하지 않는 HTML 표까지 받는다 — 잘못 고르면 헤더 판별에서 막힌다.
 */
export function detectFormat(bytes: Uint8Array): DetectedFormat {
  if (bytes.length >= OLE_MAGIC.length && OLE_MAGIC.every((byte, i) => bytes[i] === byte)) return 'kb';
  // TextDecoder 는 기본으로 BOM 을 떼고 읽는다
  const head = new TextDecoder('utf-8').decode(bytes.subarray(0, SNIFF_BYTES)).trimStart().toLowerCase();
  if (!head.startsWith('<')) return 'unknown';
  if (head.startsWith('<html') || head.startsWith('<!doctype html') || head.includes('<table')) return 'ibk';
  return 'unknown';
}

// 청구내역은 상호명이 뭉개져서 분류에 쓸 수 없다. 헤더로 판별해 아예 막는다.
// 목록 순서가 근거 문구에 나오는 이름을 정한다.
const MERCHANT_HEADERS = ['이용가맹점명', '이용하신곳', '이용하신 곳', '가맹점명', '가맹점'];
const APPROVAL_HEADERS = ['승인번호', '승인일시', '승인구분', '이용일', '이용일자'];
const BILLING_HEADERS = ['청구금액', '청구합계', '청구건수', '청구일', '청구원금', '결제원금', '잔여할부', '할부수수료', '이자'];

const squash = (text: string) => text.replace(/\s+/g, '');

const verdict = (kind: StatementVerdict['kind'], code: StatementCode, why: string): StatementVerdict => ({ kind, code, why });

/** 헤더로 승인내역 / 청구내역 / 판별불가를 가른다 (tools/parsers classify_statement) */
export function classifyStatement(headers: readonly string[]): StatementVerdict {
  const joined = headers.map(squash).join(' ');
  const hasMerchant = MERCHANT_HEADERS.filter((h) => joined.includes(squash(h)));
  const hasApproval = APPROVAL_HEADERS.filter((h) => joined.includes(h));
  const hasBilling = BILLING_HEADERS.filter((h) => joined.includes(h));

  if (hasMerchant.length > 0 && hasApproval.length > 0) {
    return verdict('승인내역', 'APPROVAL', `가맹점명(${hasMerchant[0]}) + 승인정보(${hasApproval[0]})`);
  }
  if (hasBilling.length > 0 && hasMerchant.length === 0) {
    return verdict('청구내역', 'BILLING', `청구 컬럼(${hasBilling.slice(0, 3).join(', ')}) 있고 가맹점명 없음`);
  }
  if (hasMerchant.length > 0) {
    return verdict('판별불가', 'MERCHANT_WITHOUT_APPROVAL', '가맹점명은 있는데 승인정보 컬럼이 없다');
  }
  // Python 의 joined[:60] 은 코드 포인트 단위다
  const shown = Array.from(joined).slice(0, 60).join('');
  return verdict('판별불가', 'NO_COLUMNS', `가맹점명·승인정보 컬럼을 찾지 못했다 (헤더: ${shown || '없음'})`);
}
