/**
 * 법령 조문 id. {법령명}-{조[의N]}[-{항}[-{호[의N]}]] 꼴이다 (예: 소득세법-81의6-1, 소득세법시행령-190-1-1의2).
 * 법령명이 법·령·규칙으로 끝나야 한다. 심판례-984358 같은 사례 id 가 조로 읽히지 않게 한다
 */
const LAW_ARTICLE = /^[^#-]+(?:법|령|규칙)-(\d+)(?:의(\d+))?(?:-(\d+)(?:-(\d+)(?:의(\d+))?)?)?$/;
/** 행정규칙 조문 id. {규칙명}#{문서번호}-{조[의N]} 꼴이다 (예: 국세청사무분장규정#34999-13의8). -전문 은 조가 없다 */
const RULE_ARTICLE = /^[^#]+#\d+-(\d+)(?:의(\d+))?$/;

const branch = (number: string | undefined) => number ? `의${number}` : '';

/**
 * 근거 조문의 제목. 서버 title 은 법령 이름뿐이라(C8) statuteId 로 조·항·호를 붙인다.
 * 소득세법-33-1-5 → 소득세법 제33조 제1항 제5호, 소득세법-81의6-1 → 소득세법 제81조의6 제1항.
 * 심판례·해석례처럼 조가 없는 문서는 title 이 이미 사건 제목이라 그대로 둔다.
 * 서버가 제목에 조를 넣어 주기 시작하면 그것을 그대로 쓴다
 */
export function statuteTitle(statuteId: string, lawTitle: string): string {
  if (/제\d+조/.test(lawTitle)) return lawTitle;
  const law = LAW_ARTICLE.exec(statuteId);
  if (law) {
    const [, article, articleBranch, paragraph, item, itemBranch] = law;
    return [
    lawTitle,
    `제${article}조${branch(articleBranch)}`,
    paragraph && `제${paragraph}항`,
    item && `제${item}호${branch(itemBranch)}`].
    filter(Boolean).join(' ');
  }
  const rule = RULE_ARTICLE.exec(statuteId);
  if (rule) return `${lawTitle} 제${rule[1]}조${branch(rule[2])}`;
  return lawTitle;
}

/**
 * 국가법령정보 주소. law.go.kr 은 …/제81조의6 꼴만 열고 …/제81의6조 는 오류 페이지다.
 * 말뭉치가 뒤의 꼴로 쌓아 둔 행(13,550행, C9)이 고쳐지지 않으므로 읽을 때 바꾼다
 */
export function lawGoKrUrl(url: string): string {
  return url.replace(/제(\d+)의(\d+)조/, '제$1조의$2');
}
