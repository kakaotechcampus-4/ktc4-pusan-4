/**
 * 로그인 없이 보는 공개 페이지와 검색·공유에 보일 제목·설명의 단일 원본.
 *
 * 빌드 끝에 scripts/prerender.mjs 가 이 목록대로 페이지를 HTML 로 미리 그리고(dist/<file>),
 * sitemap.xml·llms.txt 도 여기서 만든다. 화면의 탭 제목(useDocumentTitle)도 같은 title 을 쓴다.
 * 공개 페이지를 더하면 여기에 넣는다 — 빠지면 크롤러에게는 빈 화면(app.html, noindex)이 나간다.
 *
 * 설명은 화면에 실제로 적힌 사실만 쓴다. 화면에 없는 말을 검색 결과에서 하면 인용 신뢰를 잃는다.
 */

/** 배포 주소. canonical·og:url·sitemap 의 절대 주소가 된다 (deploy/production.env 의 DOMAIN) */
export const SITE_URL = 'https://ktc4-pusan-4.duckdns.org';

/** 서비스 한 줄 소개. 공유 이미지(public/og-image.png)에 적힌 문구와 같다 */
export const TAGLINE = '개인 사업자를 위한 종합소득세 경비 판정 서비스';

export interface PublicPage {
  path: string;
  /** dist 안에 쓸 파일. Caddy 가 /faq 를 faq.html 로 찾는다(deploy/Caddyfile) */
  file: string;
  /** 「제목 · PreeT」 꼴로 붙는다. PreeT 로 시작하면 그대로 쓴다 */
  title: string;
  description: string;
}

export const PAGES = {
  home: {
    path: '/',
    file: 'index.html',
    // 홈은 브랜드를 앞에 둔다. 좁은 탭에도 PreeT 가 보이고, 검색 제목에는 키워드가 남는다
    title: 'PreeT · 개인 사업자 종합소득세 경비 판정',
    description: '카드 이용내역을 올리면 거래마다 경비 가능·불가·확인 필요를 판정하고 근거 조문을 붙입니다.'
  },
  faq: {
    path: '/faq',
    file: 'faq.html',
    title: '자주 묻는 질문',
    description: '판정을 누가 하는지, 내 파일이 어디까지 가는지, 결과를 어디까지 믿어도 되는지. PreeT를 쓰기 전에 자주 묻는 것들입니다.'
  },
  terms: {
    path: '/terms',
    file: 'terms.html',
    title: '이용약관',
    description: 'PreeT 서비스 이용약관입니다.'
  },
  privacy: {
    path: '/privacy',
    file: 'privacy.html',
    title: '개인정보처리방침',
    description: 'PreeT가 어떤 정보를 왜 모으고, 어디로 보내고, 언제 지우는지 적은 개인정보처리방침입니다.'
  }
} satisfies Record<string, PublicPage>;
