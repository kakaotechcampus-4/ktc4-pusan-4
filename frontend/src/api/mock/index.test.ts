// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '../contract';

// 목업 상태는 모듈 안에 있다. 테스트마다 모듈을 새로 읽어 시드 상태에서 시작한다
let api: Api;
let batchId: string;
let controls: typeof import('./index').mockControls;

beforeEach(async () => {
  vi.resetModules();
  const mock = await import('./index');
  api = mock.mockApi;
  batchId = mock.mockSeedSession.batchId;
  controls = mock.mockControls;
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

describe('업로드 (3.3) — 올린 거래가 실제로 남는가', () => {
  /** 파서가 주는 모양. AWS 는 키워드로 맞히고, 나머지 둘은 못 맞혀 분류 확인으로 간다 */
  const request = {
    sourceType: '승인내역' as const,
    cardIssuer: '국민' as const,
    periodStart: '2026-02-01',
    periodEnd: '2026-02-28',
    fileHash: 'hash-upload-test',
    transactions: [
    { approvedAt: '2026-02-03', merchantRaw: 'AWS APN1', amount: 141_000, naturalKey: 'k1', status: 'JUDGEABLE' as const },
    { approvedAt: '2026-02-04', merchantRaw: '넷플릭스', amount: 13_500, naturalKey: 'k4', status: 'JUDGEABLE' as const },
    { approvedAt: '2026-02-05', merchantRaw: '알수없는가맹점', amount: 33_000, naturalKey: 'k2', status: 'JUDGEABLE' as const },
    { approvedAt: '2026-02-07', merchantRaw: '취소된가맹점', amount: 9_000, naturalKey: 'k3', status: 'CANCELED_OFFSET' as const }]

  };

  it('업로드한 건수만큼 거래가 생기고 거래 목록에서 보인다', async () => {
    const created = await api.uploads.create(request, 'idem-1');
    expect(created.transactionCount).toBe(4);

    const listed = await api.transactions.list({ batchId: created.id, size: 50 });
    expect(listed.page.totalElements).toBe(4);
    expect(listed.items.map((t) => t.merchantRaw).sort()).toEqual(
      ['AWS APN1', '넷플릭스', '알수없는가맹점', '취소된가맹점']
    );
    // 업로드 이력이 말하는 수와 실제 거래 수가 같아야 한다
    expect((await api.uploads.get(created.id)).transactionCount).toBe(listed.page.totalElements);
  });

  it('맞힌 가맹점은 분류 완료, 못 맞힌 판정대상만 분류 확인으로 남는다', async () => {
    const created = await api.uploads.create(request, 'idem-2');
    expect(created.classificationPendingCount).toBe(1);

    const listed = await api.transactions.list({ batchId: created.id, size: 50 });
    const aws = listed.items.find((t) => t.merchantRaw === 'AWS APN1');
    expect(aws?.classificationStatus.code).toBe('CLASSIFIED');
    expect(aws?.merchantCategory).toBe('해외SaaS');

    // 한글 가맹점도 맞힌다. 영문만 보면 「넷플릭스」가 분류 확인으로 샌다
    const netflix = listed.items.find((t) => t.merchantRaw === '넷플릭스');
    expect(netflix?.merchantCategory).toBe('구독서비스');

    const unknown = listed.items.find((t) => t.merchantRaw === '알수없는가맹점');
    expect(unknown?.classificationStatus.code).toBe('NEEDS_REVIEW');

    // 취소상계는 판정 대상이 아니라 분류 확인을 만들지 않는다
    const reviews = await api.classificationReviews.list({ batchId: created.id });
    expect(reviews.items.map((r) => r.merchantRaw)).toEqual(['알수없는가맹점']);
  });

  it('지운 배치의 거래는 함께 사라진다', async () => {
    const created = await api.uploads.create(request, 'idem-3');
    await api.uploads.remove(created.id);
    expect((await api.transactions.list({ batchId: created.id })).page.totalElements).toBe(0);
  });
});

describe('분류 확인 (3.5) — 답하면 판정이 생기는가', () => {
  it('답한 거래에 CLASSIFICATION_REVIEW 판정이 쌓이고 요약 합계가 는다', async () => {
    const before = await api.judgments.summary({ batchId });
    const group = (await api.classificationReviews.grouped({ batchId, status: 'PENDING' })).items[0];

    const result = await api.classificationReviews.respond({
      reviewIds: group.reviewIds,
      merchantCategory: '해외SaaS'
    });
    expect(result.judgedCount).toBe(group.count);

    // 세기만 하고 판정을 안 만들면 여기서 합계가 그대로다
    const after = await api.judgments.summary({ batchId });
    expect(after.totalCount).toBe(before.totalCount + group.count);

    const judged = await currentOf(group.transactions[0].transactionId);
    expect(judged.origin.type).toBe('CLASSIFICATION_REVIEW');
    expect(judged.verdict.code).toBe('AVAILABLE');
  });

  it('모르는 업종은 단정하지 않고 확인 필요로 둔다', async () => {
    const group = (await api.classificationReviews.grouped({ batchId, status: 'PENDING' })).items[0];
    await api.classificationReviews.respond({ reviewIds: group.reviewIds, merchantCategory: '기타' });
    const judged = await currentOf(group.transactions[0].transactionId);
    expect(judged.verdict.code).toBe('NEEDS_REVIEW');
    expect(judged.finalAmount).toBeNull();
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

  it('실패를 예약할 때 실패 코드를 고를 수 있다 (3.6)', async () => {
    const seed = await api.contexts.current();
    if (!seed) throw new Error('시드 문진이 없다');
    controls.failNextRun(1, 'RUN_START_FAILED');
    const run = await api.runs.create({ batchId, contextId: seed.id });
    expect((await api.runs.failures(run.id)).items.map((f) => f.errorCode)).toEqual(['RUN_START_FAILED']);

    const next = await api.runs.create({ batchId, contextId: seed.id });
    expect((await api.runs.failures(next.id)).items).toHaveLength(0);
  });
});

describe('비서 (목업)', () => {
  const context = (screen: string, transactionId: string | null = null) => ({ screen, batchId, transactionId, year: null });
  const chat = (message: string, screen: string, transactionId: string | null = null) =>
  api.assistant.chat({ message, history: [], context: context(screen, transactionId), sessionId: 's1' });

  it('지난번 답은 지금 PENDING 그룹에만 주고, 진행 상황은 채울 수 있는 질문 수를 센다', async () => {
    const { items } = await api.questions.suggestions(batchId);
    expect(items.map((s) => s.tier).sort()).toEqual(['A', 'A', 'B', 'B', 'C']);
    const progress = await api.progress.get(batchId);
    expect(progress.questions.fillableFromPrevious).toBe(2);
    expect(progress.next?.route).toBe('/preview');

    const sk = (await pendingGroups()).items.find((g) => g.groupKey === 'merchant:SK텔레콤');
    if (!sk) throw new Error('SK텔레콤 그룹이 없다');
    await api.questions.respond({ questionIds: sk.questionIds, answer: { value: '전용' }, source: 'PREVIOUS_ANSWER' });
    expect((await api.questions.suggestions(batchId)).items.some((s) => s.groupKey === 'merchant:SK텔레콤')).toBe(false);
    expect((await api.progress.get(batchId)).questions.fillableFromPrevious).toBe(1);
  });

  it('화면과 말로 제안 카드를 만든다', async () => {
    const answer = await chat('SK텔레콤은 전용 회선이야', '/questions');
    expect(answer.proposals[0]).toMatchObject({ kind: 'answer', value: '전용', source: 'ASSISTANT' });

    const override = await chat('이건 확인 필요로 바꿔 줘', '/results', tx('1005'));
    expect(override.proposals[0]).toMatchObject({ kind: 'override', toVerdict: 'NEEDS_REVIEW' });

    const note = await chat('안분 비율은 세무사에게 물어볼래', '/summary');
    expect(note.proposals[0]).toMatchObject({ kind: 'handoff_note', text: '안분 비율은 세무사에게 물어볼래' });
    expect(note.traceId).toEqual(expect.any(String));
  });

  it('세무대리인 질문을 저장하고 모아 준다', async () => {
    await api.handoffNotes.create({ text: '  안분 비율은?  ', transactionIds: [] });
    expect((await api.handoffNotes.list()).map((n) => n.text)).toEqual(['안분 비율은?']);
    await expect(api.handoffNotes.create({ text: ' ', transactionIds: [] })).rejects.toMatchObject({ status: 400 });
  });
});

describe('로그인·관리자 (목업)', () => {
  it('로그인한 이메일과 역할을 users/me 로 준다. admin@… 만 관리자다', async () => {
    await api.auth.login({ email: 'me@example.com', password: 'demo1234' });
    expect(await api.users.me()).toMatchObject({ email: 'me@example.com', role: 'USER' });
    await expect(api.admin.ruleCandidates.list()).rejects.toMatchObject({ status: 403 });

    await api.auth.login({ email: 'admin@example.com', password: 'demo1234' });
    expect((await api.users.me()).role).toBe('ADMIN');
  });

  it('비밀번호가 틀리면 401 이고, 로그인 전·로그아웃 뒤 users/me 는 401 이다', async () => {
    await expect(api.users.me()).rejects.toMatchObject({ status: 401 });
    await expect(api.auth.login({ email: 'me@example.com', password: 'wrong-password' })).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS'
    });
    await expect(api.users.me()).rejects.toMatchObject({ status: 401 });

    await api.auth.login({ email: 'me@example.com', password: 'demo1234' });
    await api.auth.logout();
    await expect(api.users.me()).rejects.toMatchObject({ status: 401 });
  });

  it('후보를 승인하면 검토한 사람이 남고, 다시 처리하면 409 다', async () => {
    await api.auth.login({ email: 'admin@example.com', password: 'demo1234' });
    const { items } = await api.admin.ruleCandidates.list({ status: 'PENDING' });
    const approved = await api.admin.ruleCandidates.approve(items[0].id);
    expect(approved).toMatchObject({ status: { code: 'APPROVED' }, reviewedBy: 'admin@example.com' });
    expect((await api.admin.ruleCandidates.list({ status: 'PENDING' })).items).toHaveLength(items.length - 1);
    await expect(api.admin.ruleCandidates.reject(items[0].id)).rejects.toMatchObject({ status: 409 });
  });
});
