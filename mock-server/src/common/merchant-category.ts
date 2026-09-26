/**
 * docs/categories.md 가 "단일 원본"으로 선언한 32종 + docs/api.md 2.12가 분류 실패용으로
 * 추가하는 '미분류'. docs/api.md 2.12 자체 표에는 27종만 나열되어 있으나 categories.md가
 * 스스로 canonical이라 명시하고(자동 생성 파일), 프론트 목업 데이터도 그 차이분 카테고리를
 * 이미 쓰고 있어 이쪽을 기준으로 삼는다.
 */
export const MERCHANT_CATEGORIES = [
  '카페',
  '음식점',
  '편의점',
  '온라인쇼핑',
  '음식배달',
  '해외SaaS',
  '국내SW',
  '통신',
  '수도광열',
  '여비교통',
  '차량',
  '도서',
  '교육',
  '광고',
  '사무용품',
  '의료',
  '금융',
  '지자체_과태료',
  '경찰청_범칙금',
  '조세',
  'PG_미상',
  '기타',
  '게임',
  '구독서비스',
  '여가',
  '미용',
  '생활용품',
  '임차료',
  '전자기기',
  '전문가수수료',
  '보험',
  '수리비',
  '미분류',
] as const;

export type MerchantCategory = (typeof MERCHANT_CATEGORIES)[number];

export function isValidMerchantCategory(value: string): value is MerchantCategory {
  return (MERCHANT_CATEGORIES as readonly string[]).includes(value);
}
