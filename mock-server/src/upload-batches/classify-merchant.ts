/**
 * 실제 저장소의 rules/keyword_rules.yaml(정규식+우선순위 엔진)은 옮기지 않는다.
 * mock은 업무 로직 정확도가 목적이 아니라 "분류 성공/실패" 두 경로가 다 동작하는
 * 느낌만 내면 되므로, 훨씬 작은 키워드 표 하나로 대체한다 (docs/api-mock-implementation.md 참고).
 */
const KEYWORD_CATEGORY: [RegExp, string][] = [
  [/AWS|AMAZON\s*WEB/i, '해외SaaS'],
  [/GITHUB|FIGMA|NOTION|VERCEL|SLACK|LINEAR|CANVA|ADOBE|OPENAI|ANTHROPIC/i, '해외SaaS'],
  [/한글과컴퓨터|네이버클라우드|이스트소프트/i, '국내SW'],
  [/NETFLIX|넷플릭스|SPOTIFY|유튜브프리미엄/i, '구독서비스'],
  [/STEAM|스팀|닌텐도|PLAYSTATION/i, '게임'],
  [/스타벅스|카페|이디야|투썸/i, '카페'],
  [/GS25|CU|세븐일레븐|이마트24|편의점/i, '편의점'],
  [/음식배달|배달의민족|쿠팡이츠/i, '음식배달'],
  [/쿠팡|11번가|온라인쇼핑/i, '온라인쇼핑'],
  [/SKT|SK텔레콤|KT통신|LGU\+|엘지유플러스/i, '통신'],
  [/한국전력|한전|도시가스|관리비|수도사업소/i, '수도광열'],
  [/카카오모빌리티|카카오\s*T|택시|KTX|철도공사|대한항공/i, '여비교통'],
  [/교보문고|예스24|알라딘/i, '도서'],
  [/인프런|패스트캠퍼스/i, '교육'],
  [/구글애즈|카카오모먼트/i, '광고'],
  [/오피스디포|모나미|사무용품/i, '사무용품'],
  [/병원|약국|의원/i, '의료'],
  [/국세청|지방세|소득세/i, '조세'],
  [/주정차위반|과태료/i, '지자체_과태료'],
  [/범칙금|통고처분/i, '경찰청_범칙금'],
  [/위워크|공유오피스|WEWORK/i, '임차료'],
  [/애플|APPLE|하이마트|전자랜드/i, '전자기기'],
  [/세무사|법무사/i, '전문가수수료'],
  [/손해보험|화재보험/i, '보험'],
  [/AS센터|수리/i, '수리비'],
  [/GS칼텍스|SK에너지|주유소|하이패스/i, '차량'],
  [/노래연습장|볼링|PC방/i, '여가'],
  [/미용실|헤어/i, '미용'],
  [/다이소|생활용품/i, '생활용품'],
];

export function classifyMerchant(merchantRaw: string): { merchantNorm: string; merchantCategory: string } {
  const merchantNorm = merchantRaw.trim();
  const hit = KEYWORD_CATEGORY.find(([pattern]) => pattern.test(merchantRaw));
  return { merchantNorm, merchantCategory: hit ? hit[1] : '미분류' };
}
