import type { BusinessContext, StoredBusinessContext } from '../types/domain';
import { formatFullDate, formatNumber } from './format';

/** 문진 업종 이름. 지금은 940909 하나만 판정한다(Interview.tsx) */
const INDUSTRY_NAME: Record<string, string> = {
  '940909': '기타자영업 (컴퓨터 프로그래머 등)'
};

/**
 * 판정하는 업종인가. 예전에 저장한 문진(62010 등)은 규칙 카드(940909)에 걸리지 않아 거의 다 「확인 필요」가 된다(#214)
 */
export const isJudgedIndustry = (industryCode: string) => industryCode in INDUSTRY_NAME;

/** 사업자 문진을 사람이 읽는 표로. 판정 확인 화면과 내 정보 화면이 같이 쓴다 */
export const contextRows = (context: BusinessContext | StoredBusinessContext) => [
{
  term: '업종',
  value: INDUSTRY_NAME[context.industryCode] ?
  `${context.industryCode} · ${INDUSTRY_NAME[context.industryCode]}` :
  context.industryCode
},
{ term: '직전연도 수입금액', value: `${formatNumber(context.prevYearRevenue)}원` },
{ term: '개업일', value: formatFullDate(context.businessOpenDate) },
{ term: '기장의무', value: context.bookkeepingDuty },
{ term: '직원', value: context.hasEmployee ? '있음' : '없음 (1인)' },
{
  term: '작업 공간 면적 비율',
  value:
  context.homeOfficeRatio === null ?
  '입력 안 함' :
  context.homeOfficeRatio > 0 ?
  `${context.homeOfficeRatio}%` :
  '해당 없음'
}];
