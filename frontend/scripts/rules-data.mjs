/**
 * 규칙 카드(rules/cards), 용어집(rules/glossary.yaml), 평가 사례(eval/cases)를 빌드 때 JSON 으로 바꿔
 * `virtual:rule-cards`, `virtual:glossary`, `virtual:eval-cases` 모듈로 내보낸다. 화면이 카드를 손으로 옮겨 적지 않고 원본을 그대로 쓴다.
 *
 * 화면이 쓰는 필드만 담는다. 읽지 못하거나 필드가 빠졌으면 빌드가 멈춘다. 잘못된 카드가 조용히 빠진 채
 * 배포되면 관문 그래프와 관리자 화면의 건수가 원본과 갈라진다.
 *
 * 경로는 이 파일 기준 ../../rules, ../../eval 이다. 배포 이미지는 frontend/ 를 /src 에, 이 둘을 /rules,
 * /eval 에 복사한다(deploy/web.Dockerfile).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const CARDS = resolve(ROOT, 'rules/cards');
const GLOSSARY = resolve(ROOT, 'rules/glossary.yaml');
const EVAL = resolve(ROOT, 'eval/cases');

const VERDICT = { 가능: 'AVAILABLE', 불가: 'UNAVAILABLE', 확인필요: 'NEEDS_REVIEW' };
const GATES = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
/** 원본 카드에 아무도 검토 표시를 하지 않았으면 이 값이다 */
const UNREVIEWED = '미검수';

const fail = (file, message) => {
  throw new Error(`[rules-data] ${file}: ${message}`);
};

const read = (path) => {
  try {
    return parse(readFileSync(path, 'utf8'));
  } catch (caught) {
    return fail(path, `YAML 을 읽지 못했습니다. ${caught instanceof Error ? caught.message : caught}`);
  }
};

const list = (value) => (value === undefined || value === null ? [] : Array.isArray(value) ? value.map(String) : [String(value)]);

/** YAML 의 날짜는 Date 로 읽힌다. 화면은 2026-09-14 꼴만 쓴다 */
const day = (value) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value === undefined || value === null ? null : String(value);

const verdictOf = (file, value) => {
  if (value === undefined || value === null) return null;
  const code = VERDICT[String(value)];
  if (!code) fail(file, `알 수 없는 판정 ${value}`);
  return code;
};

export function loadCards() {
  const files = readdirSync(CARDS).filter((name) => /^R-.*\.yaml$/.test(name)).sort();
  if (files.length === 0) fail(CARDS, '규칙 카드가 없습니다');
  const cards = files.map((name) => {
    const path = resolve(CARDS, name);
    const card = read(path);
    if (!card || typeof card !== 'object') fail(path, '비어 있습니다');
    if (typeof card.id !== 'string') fail(path, 'id 가 없습니다');
    if (!GATES.includes(card.gate)) fail(path, `알 수 없는 관문 ${card.gate}`);
    if (!card.review || typeof card.review.by !== 'string') fail(path, 'review.by 가 없습니다');
    const question = card.question
      ? {
          text: String(card.question.text ?? ''),
          options: (card.question.options ?? []).map((option) => String(option.value))
        }
      : null;
    return {
      id: card.id,
      /** 파일 이름의 밑줄 뒤. R-104_온라인쇼핑.yaml 이면 온라인쇼핑 */
      name: basename(name, '.yaml').replace(/^R-[^_]+_?/, '').replace(/_/g, ' ') || card.id,
      gate: card.gate,
      priority: Number(card.priority ?? 0),
      verdict: verdictOf(path, card.verdict),
      categories: list(card.match?.category),
      industries: list(card.match?.industry),
      /** 가맹점 이름에 이 말이 들면 맞는다. 판정 경로에서 카드를 한 줄로 풀 때 쓴다 */
      keywords: list(card.match?.keyword),
      amountMin: typeof card.match?.amount_min === 'number' ? card.match.amount_min : null,
      amountMax: typeof card.match?.amount_max === 'number' ? card.match.amount_max : null,
      holiday: card.match?.holiday === true,
      citations: (card.citations ?? []).map((citation) => String(citation.id)),
      question,
      outOfScope: card.out_of_scope === true,
      reviewed: card.review.by !== UNREVIEWED,
      reviewBy: card.review.by,
      reviewDate: day(card.review.date),
      file: `rules/cards/${name}`
    };
  });
  const seen = new Set();
  for (const card of cards) {
    if (seen.has(card.id)) fail(card.file, `id ${card.id} 가 겹칩니다`);
    seen.add(card.id);
  }
  // 엔진은 관문마다 우선순위가 높은 카드부터 맞춰 본다. 그래프도 그 순서로 세운다
  return cards.sort((a, b) => a.gate.localeCompare(b.gate) || b.priority - a.priority || a.id.localeCompare(b.id));
}

export function loadGlossary() {
  const data = read(GLOSSARY);
  const terms = data?.terms;
  if (!Array.isArray(terms) || terms.length === 0) fail(GLOSSARY, 'terms 가 비어 있습니다');
  return terms.map((item, index) => {
    if (typeof item?.term !== 'string' || typeof item?.body !== 'string') fail(GLOSSARY, `${index + 1}번째 항목에 term 이나 body 가 없습니다`);
    return {
      term: item.term,
      aliases: list(item.aliases),
      body: item.body.trim(),
      ...(item.statute ? { statute: String(item.statute) } : {})
    };
  });
}

export function loadEvalCases() {
  const files = readdirSync(EVAL).filter((name) => name.endsWith('.yaml')).sort();
  if (files.length === 0) fail(EVAL, '평가 사례가 없습니다');
  return files.map((name) => {
    const path = resolve(EVAL, name);
    const item = read(path);
    if (typeof item?.id !== 'string') fail(path, 'id 가 없습니다');
    const expected = verdictOf(path, item.기대?.판정);
    if (!expected) fail(path, '기대.판정 이 없습니다');
    return {
      id: item.id,
      gate: String(item.관문 ?? ''),
      title: String(item.제목 ?? ''),
      industry: item.사업자컨텍스트?.업종코드 === undefined ? null : String(item.사업자컨텍스트.업종코드),
      category: String(item.거래?.merchant_category ?? ''),
      expected,
      expectedGate: item.기대?.걸린게이트 ? String(item.기대.걸린게이트) : null,
      critical: item.채점?.치명 === true
    };
  });
}

/**
 * 모듈 하나에 하나씩 둔다. 한 모듈에 다 담으면 용어집만 쓰는 첫 화면 번들에 카드와 평가 사례까지 실린다
 */
const MODULES = {
  'virtual:rule-cards': () => ({ value: loadCards(), watch: [CARDS] }),
  'virtual:glossary': () => ({ value: loadGlossary(), watch: [GLOSSARY] }),
  'virtual:eval-cases': () => ({ value: loadEvalCases(), watch: [EVAL] })
};

/** Vite 플러그인. dev 서버에서는 원본이 바뀌면 다시 읽는다 */
export function rulesData() {
  return {
    name: 'preet-rules-data',
    resolveId(id) {
      return Object.hasOwn(MODULES, id) ? `\0${id}` : null;
    },
    load(id) {
      const name = id.startsWith('\0') ? id.slice(1) : null;
      if (!name || !Object.hasOwn(MODULES, name)) return null;
      const { value, watch } = MODULES[name]();
      for (const path of watch) {
        if (path.endsWith('.yaml')) this.addWatchFile(path);
        else for (const file of readdirSync(path)) this.addWatchFile(resolve(path, file));
      }
      return `export default ${JSON.stringify(value)};`;
    }
  };
}
