import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../api/contract';
import type { Api } from '../../api/contract';
import type { AssistantProposal, QuestionGroup, QuestionSuggestion } from '../../types/domain';
import { applyProposal, blockedReason, chatErrorText, previousAnswer, trimHistory } from './logic';

const fakeApi = () => {
  const api = {
    questions: {
      respond: vi.fn().mockResolvedValue({ answeredCount: 1, factId: 'f', rejudgedTransactionCount: 2 }),
      bulkAnswer: vi.fn().mockResolvedValue({ answeredCount: 3 })
    },
    classificationReviews: { respond: vi.fn().mockResolvedValue({ resolvedCount: 1, merchantCategory: '해외SaaS', judgedCount: 0 }) },
    judgments: { override: vi.fn().mockResolvedValue({}) },
    handoffNotes: { create: vi.fn().mockResolvedValue({}) }
  };
  return { api, typed: api as unknown as Api };
};

const card = { card: '요약' };

describe('trimHistory', () => {
  it('최근 20개만, 각 2,000자까지 보낸다', () => {
    const messages = Array.from({ length: 25 }, (_, i) => ({ role: 'user' as const, content: `${i}`.repeat(i === 24 ? 3000 : 1) }));
    const trimmed = trimHistory(messages);
    expect(trimmed).toHaveLength(20);
    expect(trimmed[0].content).toBe('5');
    expect(trimmed[19].content).toHaveLength(2000);
  });
});

describe('applyProposal', () => {
  const navigate = vi.fn();

  it('kind 를 보고 기존 API 를 고르고, 비서가 준 value 는 answer:{value} 로 바꿔 보낸다', async () => {
    const { api, typed } = fakeApi();
    const proposals: AssistantProposal[] = [
    { ...card, kind: 'answer', questionIds: ['q1'], value: '업무미팅', source: 'ASSISTANT' },
    { ...card, kind: 'bulk_answer', batchId: 'b1', factType: '용도', value: '개인' },
    { ...card, kind: 'classification', reviewIds: ['r1'], merchantCategory: '해외SaaS' },
    { ...card, kind: 'override', judgmentId: 'j1', toVerdict: 'AVAILABLE', reason: '미팅이었어' },
    { ...card, kind: 'handoff_note', text: '안분 비율은?', transactionIds: ['t1'] },
    { ...card, kind: 'navigation', route: '/questions' }];

    for (const proposal of proposals) await applyProposal(typed, proposal, navigate, 'key-1');

    expect(api.questions.respond).toHaveBeenCalledWith({ questionIds: ['q1'], answer: { value: '업무미팅' }, source: 'ASSISTANT' });
    expect(api.questions.bulkAnswer).toHaveBeenCalledWith({ batchId: 'b1', factType: '용도', answer: { value: '개인' } });
    expect(api.classificationReviews.respond).toHaveBeenCalledWith({ reviewIds: ['r1'], merchantCategory: '해외SaaS' });
    expect(api.judgments.override).toHaveBeenCalledWith('j1', { toVerdict: 'AVAILABLE', reason: '미팅이었어' }, 'key-1');
    expect(api.handoffNotes.create).toHaveBeenCalledWith({ text: '안분 비율은?', transactionIds: ['t1'] });
    expect(navigate).toHaveBeenCalledWith('/questions');
  });

  it('확인 필요로 바꾸는 카드와 모르는 화면 이동은 적용하지 않는다', () => {
    expect(blockedReason({ ...card, kind: 'override', judgmentId: 'j1', toVerdict: 'NEEDS_REVIEW', reason: 'x' })).not.toBeNull();
    expect(blockedReason({ ...card, kind: 'navigation', route: '/run' })).not.toBeNull();
    expect(blockedReason({ ...card, kind: 'navigation', route: '/summary' })).toBeNull();
  });
});

describe('chatErrorText', () => {
  it('429 는 Retry-After 초를 알려 준다', () => {
    expect(chatErrorText(new ApiRequestError(429, 'ASSISTANT_BUSY', 'x', '', 5))).toBe('5초 뒤에 다시 물어봐 주세요.');
    expect(chatErrorText(new ApiRequestError(429, 'LIMIT', 'x', '', 3600))).toContain('잠시 뒤');
  });

  it('서버 문장을 그대로 띄우지 않는다', () => {
    expect(chatErrorText(new ApiRequestError(500, 'INTERNAL_ERROR', 'NullPointerException'))).not.toContain('Null');
  });
});

describe('previousAnswer (명세 3.1)', () => {
  const group = (patch: Partial<QuestionGroup> = {}): QuestionGroup => ({
    groupKey: 'merchant:SK텔레콤',
    factType: '전용여부',
    status: { code: 'PENDING', label: '대기' },
    questionIds: ['q1'],
    count: 1,
    totalAmount: 78000,
    questionText: '이 회선은 업무 전용인가요?',
    options: ['전용', '공용', '개인'],
    answer: null,
    bulkAnswerable: true,
    transactions: [],
    ...patch
  });
  const suggestion = (patch: Partial<QuestionSuggestion>): QuestionSuggestion => ({
    groupKey: 'merchant:SK텔레콤',
    factType: '전용여부',
    tier: 'A',
    ...patch
  });

  it('A 이어받기는 출처와 값을 사실대로 적고 그 값으로 답할 수 있다', () => {
    expect(previousAnswer(group(), suggestion({ value: '전용', sourceLabel: '9월 업로드(국민)' }))).toEqual({
      kind: 'apply',
      value: '전용',
      text: "9월 업로드(국민)에서 '전용'으로 답했습니다."
    });
  });

  it('지금 선택지에 없는 값은 버리고, 충돌이면 이력만 보인다', () => {
    expect(previousAnswer(group(), suggestion({ value: '업무 전용', sourceLabel: '9월' }))).toBeNull();
    expect(
      previousAnswer(
        group(),
        suggestion({ value: null, conflict: true, history: [{ value: '전용', sourceLabel: '9월' }, { value: '없는 값', sourceLabel: '8월' }] })
      )
    ).toEqual({ kind: 'history', text: "지난 답이 서로 다릅니다: 9월 '전용'" });
  });

  it('소명 대기가 섞인 그룹은 A 라도 지난 답으로 채우지 않는다', () => {
    expect(previousAnswer(group({ bulkAnswerable: false }), suggestion({ value: '전용', sourceLabel: '9월' }))).toBeNull();
  });

  it('B 는 미리 고르지 않고 이력만, C 는 아무것도 보이지 않는다', () => {
    expect(previousAnswer(group(), suggestion({ tier: 'B', historyCounts: { 전용: 6, 개인: 1 } }))).toEqual({
      kind: 'history',
      text: '이 가맹점 지난 답: 전용 6 · 개인 1'
    });
    expect(previousAnswer(group(), suggestion({ tier: 'C', reason: '소명 대기' }))).toBeNull();
  });
});
