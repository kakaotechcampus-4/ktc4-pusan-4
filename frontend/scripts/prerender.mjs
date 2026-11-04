/**
 * 빌드 끝에 공개 페이지(src/seo.ts 의 PAGES)를 HTML 로 미리 그린다. package.json 의 "prerender".
 *
 * 크롤러·카카오톡 미리보기는 자바스크립트를 돌리지 않거나 덜 돌린다. 빈 #root 만 받으면 본문·제목을 못 본다.
 * 그래서 vite 가 만든 dist/index.html 을 틀로 삼아 페이지마다 본문과 head 를 채운 파일을 쓴다.
 *
 * - dist/<file>  공개 페이지. Caddy 가 /faq 를 faq.html 로 찾는다(deploy/Caddyfile)
 * - dist/app.html  본문 없는 틀 + noindex. 로그인 뒤 화면·로그인 화면·없는 주소가 모두 이것을 받는다
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const { render, PAGES, SITE_URL, documentTitle } = await import(
  pathToFileURL(join(root, 'dist-ssr', 'entry-server.js')).href
);

const EMPTY_ROOT = '<div id="root"></div>';
const template = await readFile(join(dist, 'index.html'), 'utf8');
// 두 번 돌리면 이미 채운 index.html 을 틀로 읽는다. vite build 부터 다시 해야 한다
if (!template.includes(EMPTY_ROOT) || !/<title>[^<]*<\/title>/.test(template)) {
  throw new Error('dist/index.html 이 vite 가 막 만든 틀이 아닙니다. npm run build 로 처음부터 다시 빌드하세요.');
}

const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

function fill({ title, description, head = [], body = '' }) {
  const tags = [`<meta name="description" content="${escape(description)}" />`, ...head].join('\n    ');
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

await writeFile(
  join(dist, 'app.html'),
  fill({
    title: documentTitle(null),
    description: PAGES.home.description,
    head: ['<meta name="robots" content="noindex" />']
  })
);
console.log('prerender  app.html  (본문 없음, noindex)');

for (const page of Object.values(PAGES)) {
  const body = render(page.path);
  const summary = check(page.path, body);
  await writeFile(
    join(dist, page.file),
    fill({
      title: documentTitle(page.title),
      description: page.description,
      head: [`<link rel="canonical" href="${SITE_URL}${page.path}" />`],
      body
    })
  );
  console.log(`prerender  ${page.file}  (${summary})`);
}
