import type { CardIssuer, SourceType } from './types/domain';
import type { SourceCard } from './parser/types';

/**
 * 고지 문장의 단일 원본. 고지 막대, 꼬리말, 로그인 화면, 약관이 같이 쓴다.
 * 세무대리로 오인될 소지를 막는 문장이라(#247) 없애지 않고 한 문장으로 줄였다
 */
export const DISCLAIMER =
'PreeT는 확인할 항목과 근거를 보여 줄 뿐 세액을 확정하거나 신고를 대리하지 않으며, 최종 판단에는 세무사의 확인이 필요합니다.';

/**
 * 카드사 이름. 서버 값(국민·기업)으로도 파서 값(kb·ibk)으로도 찾는다.
 * 「기업카드」는 법인카드로 읽혀서 쓰지 않는다 (C92)
 */
export const ISSUER_LABEL: Record<CardIssuer | SourceCard, string> = {
  국민: 'KB국민카드',
  기업: 'IBK기업은행',
  kb: 'KB국민카드',
  ibk: 'IBK기업은행'
};

/** 파일 종류. 서버에 올라가는 것은 승인내역뿐이다. 나머지는 올리기 화면이 막을 때 쓴다 */
export const SOURCE_LABEL: Record<SourceType, string> = {
  승인내역: '승인내역',
  청구내역: '청구내역',
  판별불가: '알 수 없는 내역'
};

/** 업로드 이름. 화면마다 같은 이름을 쓴다 (C59). 예: KB국민카드 승인내역 */
export function uploadName(batch: {cardIssuer: CardIssuer | SourceCard;sourceType: SourceType;}): string {
  return `${ISSUER_LABEL[batch.cardIssuer]} ${SOURCE_LABEL[batch.sourceType]}`;
}
