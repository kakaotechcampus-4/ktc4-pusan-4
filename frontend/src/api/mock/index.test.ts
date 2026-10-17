// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '../contract';

// 목업 상태는 모듈 안에 있다. 테스트마다 모듈을 새로 읽어 시드 상태에서 시작한다
let api: Api;
let batchId: string;

beforeEach(async () => {
  vi.resetModules();
  const mock = await import('./index');
  api = mock.mockApi;
  batchId = mock.mockSeedSession.batchId;
});

/** 시드: 1016 은 소명 대기(자동 판정 불가인데 「용도」 질문이 남음), 1005 는 카페 「용도」 질문 */
const tx = (suffix: string) => `0199c8f2-0000-7000-8000-0000000000${suffix}`;
const currentOf = async (transactionId: string) => (await api.judgments.list({ transactionId })).items[0];
const pendingGroups = () => api.questions.grouped({ batchId, status: 'PENDING', size: 50 });
const groupOf = async (transactionId: string) => {
  const group = (await pendingGroups()).items.find((g) => g.transactions.some((t) => t.transactionId === transactionId));
  if (!group) throw new Error(`${transactionId} 에 걸린 PENDING 그룹이 없다`);
  return group;
};

describe('판정 (3.7)', () => {
  it('거래 요약을 응답 시점의 거래 값으로 붙인다', async () => {
    const judgment = await currentOf(tx('1005'));
    const transaction = await api.transactions.get(tx('1005'));
    expect(judgment.transaction).toEqual({
      approvedAt: transaction.approvedAt,
      merchantRaw: transaction.merchantRaw,
      merchantNorm: transaction.merchantNorm,
      merchantCategory: transaction.merchantCategory,
      amount: transaction.amount,
      installmentMonths: transaction.installmentMonths
    });
  });

  it('제외한 거래는 현재 결과·요약에서 빠지지만 transactionId 로는 읽힌다', async () => {
    const before = await api.judgments.summary({ batchId });
    const excluded = await api.transactions.exclude(tx('1005'));
    expect(excluded).toEqual({
      id: tx('1005'),
      userInclusion: 'EXCLUDED',
      effectiveStatus: { code: 'EXCLUDED', label: '대상제외' }
    });

    const list = await api.judgments.list({ batchId, size: 100 });
    expect(list.items.some((j) => j.transactionId === tx('1005'))).toBe(false);
    expect((await api.judgments.summary({ batchId })).totalCount).toBe(before.totalCount - 1);
    expect(await currentOf(tx('1005'))).toBeDefined();
  });
});

describe('사용자 수정 (3.8, #62)', () => {
  it('확인 필요로는 바꿀 수 없다', async () => {
    const judgment = await currentOf(tx('1001'));
    await expect(
      api.judgments.override(judgment.id, { toVerdict: 'NEEDS_REVIEW', reason: '모름' }, 'k1')
    ).rejects.toMatchObject({ status: 422 });
  });

  it('현재 판정이 아닌 revision 은 409 다', async () => {
    const old = await currentOf(tx('1005'));
    const group = await groupOf(tx('1005'));
    await api.questions.respond({ questionIds: group.questionIds, answer: { value: '개인' } });
    await expect(
      api.judgments.override(old.id, { toVerdict: 'AVAILABLE', reason: '업무' }, 'k1')
    ).rejects.toMatchObject({ status: 409 });
  });

  it('수정 뒤 답변으로 자동 판정이 쌓여도 현재 판정(수정)은 다시 바꿀 수 있다', async () => {
    const first = await api.judgments.override((await currentOf(tx('1005'))).id, { toVerdict: 'AVAILABLE', reason: '업무' }, 'k1');
    const group = await groupOf(tx('1005'));
    await api.questions.respond({ questionIds: group.questionIds, answer: { value: '개인' } });

    const current = await currentOf(tx('1005'));
    expect(current.id).toBe(first.id);
    const second = await api.judgments.override(current.id, { toVerdict: 'UNAVAILABLE', reason: '개인' }, 'k2');
    expect(second.verdict.code).toBe('UNAVAILABLE');
    expect(second.transaction.merchantNorm).toBe(first.transaction.merchantNorm);
  });

  it('판정 대상이 아닌 거래는 409 다', async () => {
    const judgment = await currentOf(tx('1005'));
    await api.transactions.exclude(tx('1005'));
    await expect(
      api.judgments.override(judgment.id, { toVerdict: 'AVAILABLE', reason: '업무' }, 'k1')
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('분류 확인 (3.5)', () => {
  it('batchId 로 거르고, 답하면 배치의 대기 수가 준다', async () => {
    const other = await api.classificationReviews.list({ batchId: 'other-batch' });
    expect(other.items).toHaveLength(0);
    expect(other.unresolved.count).toBe(0);

    const grouped = await api.classificationReviews.grouped({ batchId, status: 'PENDING' });
    const group = grouped.items[0];
    expect(group.transactions[0]).toHaveProperty('merchantNorm');
    expect(group.transactions[0]).toHaveProperty('merchantCategory');

    const before = (await api.uploads.get(batchId)).classificationPendingCount;
    await api.classificationReviews.respond({ reviewIds: group.reviewIds, merchantCategory: '카페' });
    expect((await api.uploads.get(batchId)).classificationPendingCount).toBe(before - group.count);
  });
});

describe('질문 (3.9, #134)', () => {
  it('그룹은 상태·답·거래 줄을 담고, 건수 → 금액 순이다', async () => {
    const { items } = await pendingGroups();
    for (const group of items) {
      expect(group.status.code).toBe('PENDING');
      expect(group.answer).toBeNull();
      expect(group.count).toBe(group.questionIds.length);
      expect(group.count).toBe(group.transactions.length);
      expect(group.totalAmount).toBe(group.transactions.reduce((sum, t) => sum + t.amount, 0));
    }
    const keys = items.map((g) => [g.count, g.totalAmount]);
    expect(keys).toEqual(
      [...keys].sort((a, b) => b[0] - a[0] || b[1] - a[1])
    );
  });

  it('소명 대기는 일괄 응답 대상이 아니고, 수정해도 자동 판정을 본다', async () => {
    expect((await groupOf(tx('1016'))).bulkAnswerable).toBe(false);
    expect((await groupOf(tx('1005'))).bulkAnswerable).toBe(true);

    await api.judgments.override((await currentOf(tx('1016'))).id, { toVerdict: 'AVAILABLE', reason: '업무' }, 'k1');
    const group = await groupOf(tx('1016'));
    expect(group.bulkAnswerable).toBe(false);
    expect(group.transactions[0].overridden).toBe(true);
  });

  it('제외한 거래의 질문은 조회·집계에서 빠지고, 다시 포함하면 돌아온다', async () => {
    const before = await pendingGroups();
    await api.transactions.exclude(tx('1005'));
    const after = await pendingGroups();
    expect(after.items.some((g) => g.transactions.some((t) => t.transactionId === tx('1005')))).toBe(false);
    expect(after.unresolved.count).toBe(before.unresolved.count - 1);

    await api.transactions.include(tx('1005'));
    expect((await pendingGroups()).unresolved).toEqual(before.unresolved);
  });

  it('답한 그룹은 답을 담고, 질문에도 답이 붙는다', async () => {
    const group = await groupOf(tx('1005'));
    await api.questions.respond({ questionIds: group.questionIds, answer: { value: '개인' } });
    const answered = await api.questions.grouped({ batchId, status: 'ANSWERED' });
    expect(answered.items[0]).toMatchObject({ status: { code: 'ANSWERED' }, answer: { value: '개인' }, bulkAnswerable: false });
    const questions = await api.questions.list({ transactionId: tx('1005') });
    expect(questions.items[0].answer).toEqual({ value: '개인' });
  });

  it('CANCELED 로 거르면 비어 있다', async () => {
    expect((await api.questions.grouped({ batchId, status: 'CANCELED' })).items).toHaveLength(0);
  });
});

describe('질문 응답 (3.10)', () => {
  it('검사 순서대로 첫 실패를 돌려준다', async () => {
    const a = await groupOf(tx('1005'));
    const b = await groupOf(tx('1006'));
    await expect(api.questions.respond({ questionIds: [], answer: { value: '개인' } })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR'
    });
    await expect(
      api.questions.respond({ questionIds: ['none', ...a.questionIds, ...b.questionIds], answer: { value: 'x' } })
    ).rejects.toMatchObject({ status: 404, code: 'QUESTION_NOT_FOUND' });
    await expect(
      api.questions.respond({ questionIds: [...a.questionIds, ...b.questionIds], answer: { value: 'x' } })
    ).rejects.toMatchObject({ status: 409, code: 'QUESTION_GROUP_MISMATCH' });
    await expect(api.questions.respond({ questionIds: a.questionIds, answer: { value: 'x' } })).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_ANSWER_VALUE'
    });
  });
});

describe('일괄 응답 (3.11)', () => {
  it('종류가 다른 것은 skipped, 소명 대기는 excluded 로 센다', async () => {
    const { items } = await pendingGroups();
    const sameType = items.filter((g) => g.factType === '용도');
    const others = items.filter((g) => g.factType !== '용도');

    const result = await api.questions.bulkAnswer({ batchId, factType: '용도', answer: { value: '개인' } });
    expect(result.excludedCount).toBe(sameType.filter((g) => !g.bulkAnswerable).length);
    expect(result.answeredCount).toBe(sameType.filter((g) => g.bulkAnswerable).length);
    expect(result.skippedCount).toBe(others.reduce((sum, g) => sum + g.count, 0));
    expect((await groupOf(tx('1016'))).status.code).toBe('PENDING');
  });
});

describe('문진·판정 실행', () => {
  it('Context 는 userId·createdAt 을 담고, Run 은 넘긴 Context 의 버전을 쓴다', async () => {
    const seed = await api.contexts.current();
    if (!seed) throw new Error('시드 문진이 없다');
    expect(seed).toMatchObject({ userId: expect.any(String), createdAt: expect.any(String) });
    await api.contexts.create({
      industryCode: '62010',
      prevYearRevenue: 1,
      businessOpenDate: '2024-01-01',
      bookkeepingDuty: '간편장부',
      hasEmployee: false,
      homeOfficeRatio: 0
    });
    const run = await api.runs.create({ batchId, contextId: seed.id });
    expect(run.contextVersion).toBe(seed.version);
  });
});
