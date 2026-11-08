/**
 * 법령 조문 id. {법령명}-{조[의N]}[-{항}[-{호[의N]}]] 꼴이다 (예: 소득세법-81의6-1, 소득세법시행령-190-1-1의2).
 * 법령명이 법·령·규칙으로 끝나야 한다. 심판례-984358 같은 사례 id 가 조로 읽히지 않게 한다
 */
const LAW_ARTICLE = /^[^#-]+(?:법|령|규칙)-(\d+)(?:의(\d+))?(?:-(\d+)(?:-(\d+)(?:의(\d+))?)?)?$/;
/** 행정규칙 조문 id. {규칙명}#{문서번호}-{조[의N]} 꼴이다 (예: 국세청사무분장규정#34999-13의8). -전문 은 조가 없다 */
const RULE_ARTICLE = /^[^#]+#\d+-(\d+)(?:의(\d+))?$/;

const branch = (number: string | undefined) => number ? `의${number}` : '';

/**
 * 조문 id 만 있을 때의 제목. 판정 내보내기와 규칙 후보는 Citation 에 statuteId 만 준다.
 * 조문 화면(GET /statutes)은 서버가 법률, 시행령, 시행규칙 title 에 조, 항, 호를 붙여 주므로 그것을 그대로 쓴다.
 * 소득세법-33-1-5 → 소득세법 제33조 제1항 제5호, 소득세법-81의6-1 → 소득세법 제81조의6 제1항.
 * 조가 없는 문서(심판례, 해석례)는 lawTitle 을 그대로 돌려준다
 */
export function statuteTitle(statuteId: string, lawTitle: string): string {
  // 서버가 법률, 시행령, 시행규칙 제목에는 조를 붙여 준다. 고시 같은 행정규칙은 이름뿐이라 여기서 붙인다
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
