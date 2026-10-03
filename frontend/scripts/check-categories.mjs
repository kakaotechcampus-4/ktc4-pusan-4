/**
 * 가맹점 카테고리 어휘가 단일 원본(rules/categories.yaml)과 같은지 확인한다.
 * 프론트가 목록을 손으로 옮겨 적고 있어 원본이 늘면 조용히 갈라진다 — 실제로 T4 추가분 5종을 빠뜨린 적이 있다.
 * 의존성을 늘리지 않으려고 YAML 파서 대신 이 파일의 단순한 구조만 읽는다.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const yamlPath = resolve(here, '../../rules/categories.yaml');
const tsPath = resolve(here, '../src/types/domain.ts');

const source = readFileSync(yamlPath, 'utf8')
  .split('\n')
  .filter((line) => /^\s+-\s/.test(line))
  .map((line) => line.replace(/^\s+-\s*/, '').trim());

const ts = readFileSync(tsPath, 'utf8');
const start = ts.indexOf('MERCHANT_CATEGORIES = [');
if (start === -1) {
  console.error('MERCHANT_CATEGORIES 를 찾지 못했습니다:', tsPath);
  process.exit(1);
}
const block = ts.slice(start, ts.indexOf('] as const;', start));
const declared = [...block.matchAll(/'([^']+)'/g)].map((match) => match[1]);

const missing = source.filter((category) => !declared.includes(category));
const extra = declared.filter((category) => !source.includes(category));
const sameOrder = source.length === declared.length && source.every((c, i) => c === declared[i]);

if (missing.length || extra.length || !sameOrder) {
  console.error('카테고리 어휘가 rules/categories.yaml 과 다릅니다.');
  if (missing.length) console.error('  빠짐  :', missing.join(', '));
  if (extra.length) console.error('  여분  :', extra.join(', '));
  if (!missing.length && !extra.length) console.error('  순서가 다릅니다 (docs/categories.md 가 이 순서로 생성됩니다)');
  console.error(`  원본 ${source.length}종 / 선언 ${declared.length}종`);
  process.exit(1);
}

console.log(`카테고리 ${source.length}종 일치`);
