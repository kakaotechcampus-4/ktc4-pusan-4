// 토큰(tailwind.config.js)과 문서(DESIGN.md)·스타일가이드 화면이 어긋나지 않는지 본다.
// 토큰을 바꿀 때 문서를 잊으면 스타일가이드가 거짓말을 한다 — 실제로 그런 적이 있다.
//   node scripts/check-tokens.mjs
import { readFileSync } from 'node:fs';
const cfg = (await import(new URL('../tailwind.config.js', import.meta.url).href)).default;
const sg = readFileSync(new URL('../src/pages/Styleguide.tsx', import.meta.url), 'utf8');
const dm = readFileSync(new URL('../DESIGN.md', import.meta.url), 'utf8');
let bad = 0;

// 스타일가이드 TYPE 배열을 항목 단위로 읽는다
const rows = [...sg.matchAll(/\{ token: '([^']+)',[^}]*?spec: '([^']*)'/g)]
  .map(m => ({ tokens: m[1].split('/').map(s => s.trim()), spec: m[2] }));

console.log('— 타이포: 스타일가이드 spec vs 토큰 —');
for (const [name, [size, lh]] of Object.entries(cfg.theme.extend.fontSize)) {
  const row = rows.find(r => r.tokens.includes(name));
  if (!row) { console.log(`  빠짐   ${name}`); bad++; continue; }
  const want = `${parseInt(size)}/${parseInt(lh)}`;
  if (!row.spec.includes(want)) { console.log(`  어긋남 ${name}: 표 "${row.spec}" vs 토큰 ${want}`); bad++; }
}

console.log('— 색: 토큰이 DESIGN.md·스타일가이드에 다 있나 —');
const flat = {};
for (const [k, v] of Object.entries(cfg.theme.extend.colors))
  typeof v === 'string' ? (flat[k] = v)
    : Object.entries(v).forEach(([k2, v2]) => (flat[k2 === 'DEFAULT' ? k : `${k}-${k2}`] = v2));
for (const [name, hex] of Object.entries(flat)) {
  if (!dm.toUpperCase().includes(hex.toUpperCase())) { console.log(`  DESIGN.md 없음   ${name} ${hex}`); bad++; }
  if (!sg.toUpperCase().includes(hex.toUpperCase())) { console.log(`  스타일가이드 없음 ${name} ${hex}`); bad++; }
}
console.log(bad === 0 ? '\n전부 일치' : `\n어긋남 ${bad}건`);
process.exit(bad === 0 ? 0 : 1);
