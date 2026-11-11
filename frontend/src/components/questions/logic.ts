import { ApiRequestError } from '../../api/contract';
import type { Api } from '../../api/contract';
import type { AnswerSource, Coded, Judgment, QuestionGroup, Verdict } from '../../types/domain';

/**
 * 질문 선택지의 화면 이름. 서버에는 룰카드 값을 그대로 보내고 화면에서만 풀어 쓴다.
 * 뜻을 rules/cards 에서 확인한 값만 둔다. 같은 카드 안에서 이름이 겹치면 안 된다(테스트가 본다)
 */
export const ANSWER_LABEL: Record<string, string> = {
  // 카페·음식점·배달·경조사와 그 주말 카드. 거래처에 쓴 돈이고 접대비(§35①)로 간다
  업무미팅: '거래처 접대',
  // 카페(R-300·R-312). 카페에서 혼자 일한 것이다. 개인과 같이 불가지만 뜻이 다르다
  혼자작업: '혼자 일함',
  개인: '개인 용도',
  개인용: '개인 용도',
  '업무·개인 혼용': '업무와 개인 둘 다',
  // 통신(R-205)의 「업무 전용인가요?」에 대한 답
  전용: '업무 전용',
  공용: '업무와 개인 둘 다',
  // 여비교통·숙박(R-208·R-310·R-314)의 용도
  업무출장: '업무 출장',
  '고의·중대한 과실': '고의 또는 중대한 과실',
  // 보험(R-213). 사업장 화재·배상책임 보험이다
  '사업장 재산·배상책임': '사업장 재산 또는 배상책임',
  // 비품(R-241). 선택지만 해요체다
  'PC·휴대폰·가구 같은 물건이에요': 'PC, 휴대폰, 가구 같은 물건',
  '그 외 100만 원 넘는 물건이 있어요': '그 외 100만 원 넘는 물건',
  '100만 원 넘는 물건은 없어요': '100만 원 넘는 물건 없음'
};

/**
 * 예전 카드 버전의 선택지(70d13a9d 에서 업무·개인 혼용으로 합쳤다). 그 전에 만든 질문에 남아 있다.
 * 지금 카드에는 없어 위 표와 나눈다(위 표는 지금 카드에 있는 값만 둔다)
 */
export const LEGACY_ANSWER_LABEL: Record<string, string> = {
  '업무·개인 혼재': '업무와 개인 둘 다',
  '업무·개인 섞임': '업무와 개인 둘 다'
};

export const answerLabel = (value: string) => ANSWER_LABEL[value] ?? LEGACY_ANSWER_LABEL[value] ?? value;

/** 응답을 잃은 뒤 저장됐는지도 확인하지 못했다 */
export const UNCONFIRMED_CODE = 'ANSWER_UNCONFIRMED';

/**
 * 답을 보낸다. 응답을 잃으면(연결 끊김) 서버에 저장됐는지 먼저 보고, 저장됐으면 성공으로 본다.
 * 그대로 실패로 보여 주면 사용자가 다시 골라 같은 답으로 한 번 더 판정한다 (C49).
 * 저장됐는지도 모르면 UNCONFIRMED_CODE 로 던진다
 */
export async function respondOnce(api: Api, group: QuestionGroup, value: string, source?: AnswerSource) {
  try {
    await api.questions.respond({ questionIds: group.questionIds, answer: { value }, source });
  } catch (caught) {
    if (!(caught instanceof ApiRequestError) || caught.status !== 0) throw caught;
    const [first] = group.transactions;
    let saved: string | undefined;
    try {
      const page = await api.questions.list({ transactionId: first.transactionId, size: 100 });
      saved = page.items.find((question) => question.id === first.questionId)?.answer?.value;
    } catch {
      throw new ApiRequestError(0, UNCONFIRMED_CODE, '저장됐는지 확인하지 못했습니다. 목록을 다시 불러왔습니다.');
    }
    if (saved !== value) throw caught;
  }
}

export interface VerdictTally {
  verdict: Coded<Verdict>;
  count: number;
  /**
   * 가능이면 경비 가능 금액(finalAmount)의 합이다. 결제 금액이 아니다 — 자산은 그해 넣을 수 있는 만큼만 가능이다.
   * 확인 필요와 불가는 경비로 넣을 금액이 없어 null 이다
   */
  amount: number | null;
}

const VERDICT_ORDER: Verdict[] = ['AVAILABLE', 'NEEDS_REVIEW', 'UNAVAILABLE'];

export const tallyVerdicts = (judgments: Pick<Judgment, 'verdict' | 'finalAmount'>[]): VerdictTally[] =>
VERDICT_ORDER.flatMap((code) => {
  const rows = judgments.filter((judgment) => judgment.verdict.code === code);
  return rows.length === 0 ?
  [] :
  [{
    verdict: rows[0].verdict,
    count: rows.length,
    amount: code === 'AVAILABLE' ? rows.reduce((sum, row) => sum + (row.finalAmount ?? 0), 0) : null
  }];
});

/**
 * 답한 거래들의 지금 판정. 답 API 는 판정을 주지 않아 거래마다 읽는다 (C28).
 * 못 읽으면 null 이고, 그때는 답한 것만 알린다
 */
export async function verdictsAfter(api: Api, group: QuestionGroup): Promise<VerdictTally[] | null> {
  try {
    const pages = await Promise.all(
      group.transactions.map((row) => api.judgments.list({ transactionId: row.transactionId, size: 1 }))
    );
    return tallyVerdicts(pages.flatMap((page) => page.items.slice(0, 1)));
  } catch {
    return null;
  }
}

/**
 * 다시 읽은 목록에 이 화면에서 답한 카드를 원래 자리로 끼운다. 답한 카드가 빠지면 다음 카드의
 * 선택지가 포인터 밑으로 올라와, 한 번 더 누른 것이 안 본 질문의 답이 된다 (C68).
 * held 는 index 오름차순이고 items 에는 held 의 것이 빠져 있어야 한다
 */
export const withHeld = <T>(items: T[], held: {index: number;item: T;}[]): T[] =>
held.reduce((list, { index, item }) => [...list.slice(0, index), item, ...list.slice(index)], items);
