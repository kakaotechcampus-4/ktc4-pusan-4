/**
 * 빌드 끝에 공개 페이지(src/seo.ts 의 PAGES)를 HTML 로 미리 그린다. package.json 의 "prerender".
 *
 * 크롤러·카카오톡 미리보기는 자바스크립트를 돌리지 않거나 덜 돌린다. 빈 #root 만 받으면 본문·제목을 못 본다.
 * 그래서 vite 가 만든 dist/index.html 을 틀로 삼아 페이지마다 본문과 head 를 채운 파일을 쓴다.
 *
 * - dist/<file>  공개 페이지. Caddy 가 /faq 를 faq.html 로 찾는다(deploy/caddy/Caddyfile)
 * - dist/app.html  본문 없는 틀 + noindex. 로그인 뒤 화면·로그인 화면·없는 주소가 모두 이것을 받는다
 * - dist/robots.txt · sitemap.xml · llms.txt  크롤러와 AI 에게 주는 안내
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const { render, PAGES, SITE_URL, TAGLINE, NOT_DOING, documentTitle } = await import(
  pathToFileURL(join(root, 'dist-ssr', 'entry-server.js')).href
);

const EMPTY_ROOT = '<div id="root"></div>';
const template = await readFile(join(dist, 'index.html'), 'utf8');
// 두 번 돌리면 이미 채운 index.html 을 틀로 읽는다. vite build 부터 다시 해야 한다
if (!template.includes(EMPTY_ROOT) || !/<title>[^<]*<\/title>/.test(template)) {
  throw new Error('dist/index.html 이 vite 가 막 만든 틀이 아닙니다. npm run build 로 처음부터 다시 빌드하세요.');
}

const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

/** 카카오톡·SNS 공유 미리보기. 이미지는 public/og-image.png (1200×630) */
function openGraph({ title, description, url }) {
  return [
  '<meta property="og:type" content="website" />',
  '<meta property="og:site_name" content="PreeT" />',
  '<meta property="og:locale" content="ko_KR" />',
  `<meta property="og:title" content="${escape(title)}" />`,
  `<meta property="og:description" content="${escape(description)}" />`,
  // 공개 페이지가 아니면 주소를 적지 않는다. 미리보기는 공유한 주소를 그대로 쓴다
  ...(url ? [`<meta property="og:url" content="${url}" />`] : []),
  `<meta property="og:image" content="${SITE_URL}/og-image.png" />`,
  '<meta property="og:image:width" content="1200" />',
  '<meta property="og:image:height" content="630" />',
  `<meta property="og:image:alt" content="PreeT, ${escape(TAGLINE)}" />`,
  '<meta name="twitter:card" content="summary_large_image" />'];

}

function fill({ title, description, url, head = [], body = '' }) {
  const tags = [
  `<meta name="description" content="${escape(description)}" />`,
  ...head,
  ...openGraph({ title, description, url })].
  join('\n    ');
  return template.
  replace(/<title>[^<]*<\/title>/, `<title>${escape(title)}</title>\n    ${tags}`).
  replace(EMPTY_ROOT, `<div id="root">${body}</div>`);
}

/**
 * 미리 그린 결과가 비거나 제목이 없으면 빌드를 깨뜨린다. 화면 코드가 서버 렌더에서 빈 껍데기만 내도
 * 빌드는 통과하고 크롤러만 조용히 빈 페이지를 받게 되는 사고를 여기서 막는다
 */
function check(path, body) {
  const h1 = body.match(/<h1[\s>]/g)?.length ?? 0;
  const text = body.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
  if (h1 !== 1 || text < 200) {
    throw new Error(`${path}: h1 ${h1}개, 본문 ${text}자. h1 은 1개, 본문은 200자 이상이어야 합니다.`);
  }
  return `h1 ${h1}, 본문 ${text}자`;
}

const pages = Object.values(PAGES);
const urlOf = (page) => `${SITE_URL}${page.path}`;

/**
 * 검색 결과에 뜨는 사이트 이름. 구글은 WebSite 구조화 데이터의 name 을 제일 먼저 보고,
 * 없으면 og:site_name → title → 도메인 순으로 내려간다. 지금은 이게 없어서 도메인까지 내려갔고,
 * duckdns.org 가 공용 DDNS 라 「Duck DNS」가 나왔다 (og:site_name 은 이미 PreeT 였는데도).
 * 구글 지침대로 홈에만 넣는다
 */
const WEBSITE_JSON_LD = `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'PreeT',
  url: `${SITE_URL}/`,
  description: PAGES.home.description,
  inLanguage: 'ko-KR'
})}</script>`;

await writeFile(
  join(dist, 'app.html'),
  fill({
    title: documentTitle(null),
    description: PAGES.home.description,
    head: ['<meta name="robots" content="noindex" />']
  })
);
console.log('prerender  app.html  (본문 없음, noindex)');

for (const page of pages) {
  const body = render(page.path);
  const summary = check(page.path, body);
  await writeFile(
    join(dist, page.file),
    fill({
      title: documentTitle(page.title),
      description: page.description,
      url: urlOf(page),
      head: [
      `<link rel="canonical" href="${urlOf(page)}" />`,
      ...(page === PAGES.home ? [WEBSITE_JSON_LD] : [])],

      body
    })
  );
  console.log(`prerender  ${page.file}  (${summary})`);
}

/*
 * AI 학습·검색·열람 크롤러를 포함해 모두 허용한다(2026-11-04 결정. 인용·모델 인지를 노린다).
 * 로그인 뒤 화면은 Disallow 로 막지 않는다. 막으면 크롤러가 app.html 의 noindex 를 읽지 못해
 * 주소만 색인될 수 있다
 */
await writeFile(
  join(dist, 'robots.txt'),
  [
  '# PreeT: 검색엔진과 AI 크롤러(학습, 검색, 열람)를 모두 허용합니다.',
  'User-agent: *',
  'Allow: /',
  '',
  `Sitemap: ${SITE_URL}/sitemap.xml`,
  ''].
  join('\n')
);

// lastmod 는 넣지 않는다. 내용이 실제로 바뀐 날을 댈 근거가 없고, 틀린 lastmod 는 무시당한다
await writeFile(
  join(dist, 'sitemap.xml'),
  [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...pages.map((page) => `  <url><loc>${urlOf(page)}</loc></url>`),
  '</urlset>',
  ''].
  join('\n')
);

/*
 * AI 에게 주는 사이트 안내(llmstxt.org). 화면에 이미 적힌 사실만 쓴다 —
 * 근거·동기화·지원 파일은 꼬리말(MarketingFooter), 지원 업종은 FAQ, 하지 않는 일은 랜딩(NOT_DOING).
 * 거기를 고치면 여기도 맞춘다
 */
await writeFile(
  join(dist, 'llms.txt'),
  [
  '# PreeT',
  '',
  `> ${TAGLINE}. ${PAGES.home.description}`,
  '',
  '## 페이지',
  '',
  ...pages.map((page) => `- [${page.title}](${urlOf(page)}): ${page.description}`),
  '',
  '## 판정 근거와 범위',
  '',
  '- 판정 근거: 국가법령정보 OPEN API에서 받은 소득세법 조문. 매일 03:00 KST에 동기화합니다.',
  '- 지원 파일: KB국민카드, IBK기업은행 승인내역',
  '- 지원 업종: 지금은 프리랜서 인적용역 사업자(국세청 업종코드 940909)만 판정합니다.',
  `- 하지 않는 일: ${NOT_DOING.map((item) => item.title).join(', ')}`,
  '- 결과는 확인할 항목과 근거까지입니다. 최종 판단에는 세무사의 확인이 필요합니다.',
  ''].
  join('\n')
);
console.log('prerender  robots.txt · sitemap.xml · llms.txt');
