// @vitest-environment jsdom
import { execFileSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { detectFormat } from './detect';
import { naturalKey } from './hash';
import { parseCardBytes } from './index';
import type { ParsedRow } from './index';
import { MEDICAL_PREFIX } from './primitives';
import { buildIbkHtml, buildKbXls } from './samples';
import type { IbkSample, KbSample } from './samples';

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

const REPO_ROOT = resolve(process.cwd(), '..');
const RUN_SAMPLES = process.env.PARITY_SAMPLES === '1';
const REAL_FILES = (process.env.PARITY_FILES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const COMPARED_FIELDS = [
  'approved_at',
  'raw_merchant',
  'amount',
  'installment_months',
  'approval_no',
  'biz_no',
  'memo',
  'source_card',
  'status',
  'is_aggregated',
  'needs_review',
  'review_reason'
] as const;

type ComparedField = (typeof COMPARED_FIELDS)[number];

/** RFC 4180 CSV 파서. 모든 값을 문자열 그대로 둔다 */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const [headers, ...body] = rows;
  return body
    .filter((r) => !(r.length === 1 && r[0] === ''))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] ?? '';
      });
      return obj;
    });
}

function rowToCsvMap(row: ParsedRow): Record<ComparedField, string> {
  return {
    approved_at: row.approvedAt,
    raw_merchant: row.rawMerchant,
    amount: row.amount === null ? '' : String(row.amount),
    installment_months: String(row.installmentMonths),
    approval_no: row.approvalNo,
    biz_no: row.bizNo,
    memo: row.memo,
    source_card: row.sourceCard,
    status: row.status,
    is_aggregated: row.isAggregated ? 'true' : '',
    needs_review: row.needsReview ? 'true' : '',
    review_reason: row.reviewReason
  };
}

interface PythonRunResult {
  kind: '승인내역' | '청구내역' | '판별불가';
  why: string;
  rows: Record<string, string>[];
}

function runPythonParser(filePath: string, issuer: 'kb' | 'ibk', workDir: string, tag: string): PythonRunResult {
  const csvPath = join(workDir, `${tag}.csv`);
  const logPath = join(workDir, `${tag}.log`);
  const fd = openSync(logPath, 'w');
  try {
    execFileSync(
      'uv',
      [
        'run',
        '--no-project',
        '--python',
        '3.12',
        '--with',
        'xlrd',
        '--with',
        'beautifulsoup4',
        '--with',
        'lxml',
        '--with',
        'pyyaml',
        'python',
        'tools/parse_card_xls.py',
        filePath,
        '--card-type',
        issuer,
        '-o',
        csvPath
      ],
      { cwd: REPO_ROOT, stdio: ['ignore', fd, fd] }
    );
  } finally {
    closeSync(fd);
  }

  // 로그에는 가맹점명이 들어 있으므로 판별 줄만 뽑고 내용은 절대 출력하지 않는다
  const log = readFileSync(logPath, 'utf-8');
  const marker = '=== 승인내역 / 청구내역 판별 ===';
  const pos = log.indexOf(marker);
  if (pos < 0) throw new Error(`statement verdict header missing for ${tag}`);
  const after = log.slice(pos + marker.length).split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
  const match = /(승인내역|청구내역|판별불가)\s+\((.*)\)\s*$/.exec(after);
  if (!match) throw new Error(`failed to parse verdict line for ${tag}`);

  const kind = match[1] as PythonRunResult['kind'];
  const why = match[2];
  const rows = kind === '승인내역' ? parseCsv(readFileSync(csvPath, 'utf-8')) : [];
  return { kind, why, rows };
}

/**
 * TS 파서와 Python 파서의 결과를 비교한다.
 * 실제 파일 내용이 테스트 출력에 남지 않도록 차이 목록에는 행 번호와 필드 이름만 담는다.
 */
async function compareWithPython(bytes: ArrayBuffer, filePath: string, workDir: string, tag: string) {
  const issuer = detectFormat(new Uint8Array(bytes));
  expect(issuer === 'kb' || issuer === 'ibk').toBe(true);
  if (issuer !== 'kb' && issuer !== 'ibk') throw new Error('unreachable');

  const py = runPythonParser(filePath, issuer, workDir, tag);
  const ts = await parseCardBytes(bytes);
  const tsKind = ts.kind === 'parsed' ? '승인내역' : ts.statement;
  expect(tsKind).toBe(py.kind);

  if (ts.kind === 'blocked') {
    return { kind: tsKind, whyMatches: ts.why === py.why, rowCount: 0, diffs: [] as string[] };
  }

  expect(ts.rows).toHaveLength(py.rows.length);
  const diffs: string[] = [];

  for (let i = 0; i < ts.rows.length; i++) {
    const tsRow = ts.rows[i];
    const pyRow = py.rows[i];
    const mapped = rowToCsvMap(tsRow);

    for (const field of COMPARED_FIELDS) {
      if (mapped[field] !== pyRow[field]) {
        diffs.push(`row ${i}: ${field}`);
      }
    }

    if (tsRow.masked) {
      // 마스킹한 행은 원래 상호 대신 의료_마스킹 으로 키를 만든다 (docs/schema_mapping.md 4장)
      const expectedKey = await naturalKey(tsRow.approvedAt, MEDICAL_PREFIX, tsRow.amount, tsRow.approvalNo);
      if (tsRow.naturalKey !== expectedKey) {
        diffs.push(`row ${i}: natural_key(masked)`);
      }
    } else if (tsRow.naturalKey !== pyRow.natural_key) {
      diffs.push(`row ${i}: natural_key`);
    }
  }

  return { kind: tsKind, whyMatches: true, rowCount: ts.rows.length, diffs };
}

describe.skipIf(!RUN_SAMPLES && REAL_FILES.length === 0)('Python 파서 대조 (parity)', () => {
  let workDir = '';

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), 'card-parity-'));
  });

  afterAll(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  describe.skipIf(!RUN_SAMPLES)('인메모리 샘플 7종', () => {
    const kbVariants: KbSample[] = ['full', 'noSummary', 'billing', 'empty'];
    const ibkVariants: IbkSample[] = ['full', 'billing', 'noHeader'];

    for (const variant of kbVariants) {
      it(`KB ${variant}`, async () => {
        const bytes = await buildKbXls(variant);
        const filePath = join(workDir, `kb_${variant}.xls`);
        writeFileSync(filePath, new Uint8Array(bytes));
        const res = await compareWithPython(bytes, filePath, workDir, `kb_${variant}`);
        expect(res.whyMatches).toBe(true);
        expect(res.diffs).toEqual([]);
      }, 300_000);
    }

    for (const variant of ibkVariants) {
      it(`IBK ${variant}`, async () => {
        const html = buildIbkHtml(variant);
        const bytes = new TextEncoder().encode(html).buffer as ArrayBuffer;
        const filePath = join(workDir, `ibk_${variant}.xls`);
        writeFileSync(filePath, new Uint8Array(bytes));
        const res = await compareWithPython(bytes, filePath, workDir, `ibk_${variant}`);
        expect(res.whyMatches).toBe(true);
        expect(res.diffs).toEqual([]);
      }, 300_000);
    }
  });

  describe.skipIf(REAL_FILES.length === 0)('실제 파일 (PARITY_FILES)', () => {
    REAL_FILES.forEach((filePath, index) => {
      it(`file #${index + 1}`, async () => {
        const buf = readFileSync(filePath);
        const bytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        const res = await compareWithPython(bytes, filePath, workDir, `real_${index}`);
        expect(res.diffs).toEqual([]);
      }, 300_000);
    });
  });
});
