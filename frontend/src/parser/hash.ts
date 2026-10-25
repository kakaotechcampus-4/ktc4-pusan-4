import { ParserError } from './primitives';

/**
 * 해시는 WebCrypto 로 계산한다. HTTPS 나 localhost 에서만 쓸 수 있다 — 배포는 Caddy HTTPS 다.
 * crypto 는 부를 때마다 읽는다. 테스트가 바꿔 끼운 값을 보게 하려는 것이다.
 */
function subtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new ParserError('HASH_UNAVAILABLE', '이 브라우저에서는 파일 해시를 계산할 수 없습니다. HTTPS 주소로 접속해 주세요.');
  }
  return subtle;
}

const HEX = Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, '0'));

export async function sha256Hex(data: BufferSource): Promise<string> {
  const digest = new Uint8Array(await subtleCrypto().digest('SHA-256', data));
  let hex = '';
  for (const byte of digest) hex += HEX[byte];
  return hex;
}

/** 업로드 계약의 fileHash. 원본 파일 바이트 전체의 SHA-256 이다 (api.md 3.3) */
export async function fileHash(bytes: ArrayBuffer): Promise<string> {
  return `sha256:${await sha256Hex(bytes)}`;
}

const encoder = new TextEncoder();

/**
 * 같은 거래가 두 번 들어가는 것을 막는 키. hash(승인일|상호|금액|승인번호) 의 앞 16자다
 * (tools/parsers natural_key). 날짜나 금액이 없으면 만들지 않는다.
 *
 * 상호는 호출하는 쪽이 정한다. 의료 업종은 실제 상호 대신 MEDICAL_PREFIX 를 넘긴다 —
 * 승인일 · 금액 · 승인번호는 서버에 평문으로 남으므로, 실제 상호로 해시하면 병원 이름
 * 목록만으로 상호를 되찾을 수 있다. 승인번호가 있어 키는 여전히 거래마다 다르다.
 */
export async function naturalKey(
approvedAt: string,
keyMerchant: string,
amount: number | null,
approvalNo: string)
: Promise<string> {
  if (!approvedAt || amount === null) return '';
  const hex = await sha256Hex(encoder.encode(`${approvedAt}|${keyMerchant}|${amount}|${approvalNo}`));
  return hex.slice(0, 16);
}
