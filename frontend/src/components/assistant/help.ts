/**
 * 비서 패널의 도움말 (FR-12, 1단계). LLM 없이 화면이 바로 답한다 — 비서가 죽어도 쓸 수 있어야 한다(QR-4).
 * 문장은 화면 문구와 docs/ 의 현재 규칙에서 옮겼다. 규칙이 바뀌면 여기도 고친다
 */

/** 승인내역 받는 길. 업로드 화면의 막힌 카드와 도움말이 같은 문장을 쓴다 */
export const APPROVAL_EXPORT_STEPS = '카드사 홈페이지·앱 → 이용(승인)내역 조회 → 엑셀 저장';

/**
 * 비서에게 물을 때 외부 모델로 가는 것 (QR-7). 비서 도구(ai/assistant/tools.py)가 모델에 넘기는 필드에서 뽑았다.
 * 업로드 화면의 데이터 경계 안내와 도움말이 같은 문장을 쓴다
 */
export const ASSISTANT_SENDS =
'묻는 말과 최근 대화, 지금 화면, 답에 필요한 거래(승인일·가맹점명·카테고리·금액)·판정·질문·근거 조문';
export const ASSISTANT_DOES_NOT_SEND = '소득 금액·이름·이메일은 보내지 않습니다.';

export interface HelpTopic {
  id: string;
  label: string;
  text: string;
}

export const HELP_TOPICS: HelpTopic[] = [
{
  id: 'flow',
  label: '화면 흐름',
  text: '카드내역 올리기 → 분류 확인 → 사업자 문진 → 판정 전 확인 → 판정 → 결과와 질문 → 요약 순서로 진행합니다. 질문에 답하면 묶인 거래를 바로 다시 판정합니다.'
},
{
  id: 'review',
  label: '확인 필요',
  text: '확인 필요는 실패가 아닙니다. 질문에 답하면 판정이 정해지는 거래이거나, 규칙으로 다루지 않아 세무대리인이 봐야 하는 거래입니다.'
},
{
  id: 'presumed',
  label: '소명 대기',
  text: '불가로 추정했지만 사정을 밝히면 풀리는 거래입니다. 주말·공휴일 식대처럼 건마다 사정이 달라 하나씩 답해야 하고, 지난번 답이나 한 번에 답하기로 채우지 않습니다.'
},
{
  id: 'approval',
  label: '승인내역 받는 법',
  text: `${APPROVAL_EXPORT_STEPS}. 청구내역은 할부가 회차별로 쪼개져 있어 판정에 쓰지 않습니다.`
},
{
  id: 'boundary',
  label: '비서에게 보내는 것',
  text: `비서에게 물으면 ${ASSISTANT_SENDS}을 외부 모델로 보냅니다. ${ASSISTANT_DOES_NOT_SEND}`
},
{
  id: 'scope',
  label: '하지 않는 일',
  text: '세무 신고·제출·환급 대행, 세액 확정, 절세 상담, 안분 비율 제안은 하지 않습니다. 판단이 필요한 질문은 요약 화면의 「세무대리인에게 넘길 문장」으로 정리합니다.'
}];
