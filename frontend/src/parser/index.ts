import { classifyStatement, detectFormat } from './detect';
import { fileHash } from './hash';
import { decodeIbk, readIbk } from './ibk';
import { readKb } from './kb';
import { runPipeline } from './pipeline';
import { ParserError } from './primitives';
import { toRequest } from './request';
import type { ParseOutcome } from './types';

export type {
  AdapterResult,
  BlockedCode,
  BlockedOutcome,
  Cell,
  DetectedFormat,
  Grid,
  ParseOutcome,
  ParseStats,
  ParsedOutcome,
  ParsedRow,
  ParserStatus,
  RawRecord,
  SourceCard,
  StatementCode,
  StatementVerdict,
  UnsendableCode,
  UnsendableRow
} from './types';
export { sampleFiles } from './samples';
export type { IbkSample, KbSample, SampleFile } from './samples';

/**
 * 카드내역 파일 바이트를 읽어 승인내역 여부를 판별하고, 후처리 결과와 업로드 요청을 돌려준다.
 * 청구내역 · 판별불가 · 열지 못하는 파일은 예외 대신 kind: 'blocked' 로 돌려준다.
 * Web Crypto 를 쓸 수 없는 환경(HASH_UNAVAILABLE)만 예외로 올린다.
 */
export async function parseCardBytes(bytes: ArrayBuffer): Promise<ParseOutcome> {
  const detected = detectFormat(new Uint8Array(bytes));
  if (detected === 'unknown') {
    return {
      kind: 'blocked',
      statement: '판별불가',
      code: 'UNKNOWN_FORMAT',
      why: '형식 판별 실패 — 건너뜁니다',
      detected
    };
  }

  let adapter;
  try {
    adapter = detected === 'kb' ? await readKb(bytes) : readIbk(decodeIbk(bytes));
  } catch (error) {
    if (error instanceof ParserError && error.code === 'KB_READ') {
      return {
        kind: 'blocked',
        statement: '판별불가',
        code: 'UNREADABLE',
        why: error.message,
        detected
      };
    }
    throw error;
  }

  const verdict = classifyStatement(adapter.headers);
  if (verdict.code !== 'APPROVAL') {
    return {
      kind: 'blocked',
      statement: verdict.kind === '청구내역' ? '청구내역' : '판별불가',
      code: verdict.code,
      why: verdict.why,
      detected
    };
  }

  const [{ rows, stats }, hash] = await Promise.all([runPipeline(adapter), fileHash(bytes)]);
  const { request, unsendable } = toRequest(rows, detected, hash, adapter.declaredPeriod);
  return {
    kind: 'parsed',
    issuer: detected,
    rows,
    request,
    unsendable,
    stats
  };
}

export async function parseCardFile(file: Blob): Promise<ParseOutcome> {
  return parseCardBytes(await file.arrayBuffer());
}
