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

  it('접대비 한도 총액은 판정 대상 거래만 센다. 제외한 거래는 요약 계정과 같이 빠진다 (#226)', async () => {
    for (const id of ['1005', '1016']) {
      const group = await groupOf(tx(id));
      await api.questions.respond({ questionIds: group.questionIds, answer: { value: '업무미팅' } });
    }
    await api.transactions.exclude(tx('1005'));
    const summary = await api.judgments.summary({ batchId });
    const entertainment = summary.byAccount.find((row) => row.account === '접대비');
    expect(entertainment).toBeDefined();
    expect(summary.limits).toHaveLength(1);
    expect(summary.limits[0].totalAmount).toBe(entertainment?.finalAmount);
    expect(summary.limits[0].excessAmount).toBe(0);
    // 비교는 ID(접대비)로, 화면은 이름(기업업무추진비)으로 한다 (api.md 3.7)
    expect(entertainment?.accountLabel).toBe('기업업무추진비');
    expect(summary.limits[0].bucketLabel).toBe('기업업무추진비');
    expect(summary.limits[0].limitAmount).toBeGreaterThan(0);
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

  it('제외한 거래의 분류 확인은 목록과 대기 수에서 빠지고, 다시 넣으면 돌아온다', async () => {
    const { items } = await api.classificationReviews.list({ batchId, status: 'PENDING' });
    const target = items[0];
    const before = (await api.uploads.get(batchId)).classificationPendingCount;

    await api.transactions.exclude(target.transactionId);
    expect((await api.uploads.get(batchId)).classificationPendingCount).toBe(before - 1);
    const after = await api.classificationReviews.list({ batchId, status: 'PENDING' });
    expect(after.items.some((r) => r.id === target.id)).toBe(false);
    expect(after.unresolved.count).toBe(before - 1);

    await api.transactions.include(target.transactionId);
    expect((await api.uploads.get(batchId)).classificationPendingCount).toBe(before);
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
      industryCode: '940909',
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

describe('가입·카카오 로그인 (목업, #193·#176)', () => {
  it('코드 받기 → 확인 → 가입하면 바로 로그인되고, 그 비밀번호로 다시 들어온다', async () => {
    await api.auth.requestEmailVerification({ email: ' New@Example.com ' });
    const { verificationToken } = await api.auth.confirmEmailVerification({ email: 'new@example.com', code: '123456' });
    await api.auth.signup({ email: 'new@example.com', password: 'longenough1!', verificationToken });
    expect(await api.users.me()).toMatchObject({ email: 'new@example.com' });

    await api.auth.logout();
    await api.auth.login({ email: 'NEW@example.com', password: 'longenough1!' });
    expect((await api.users.me()).email).toBe('new@example.com');
    // 가입한 이메일은 코드를 다시 받을 수 없다
    await expect(api.auth.requestEmailVerification({ email: 'new@example.com' })).rejects.toMatchObject({
      status: 409,
      code: 'EMAIL_ALREADY_EXISTS'
    });
  });

  it('60초 안에 다시 받으면 429 이고 남은 초를 message 에 담는다', async () => {
    await api.auth.requestEmailVerification({ email: 'a@example.com' });
    const caught = await api.auth.requestEmailVerification({ email: 'a@example.com' }).catch((error: unknown) => error);
    expect(caught).toMatchObject({ status: 429, code: 'VERIFICATION_RESEND_TOO_SOON' });
    expect((caught as Error).message).toMatch(/\d+초/);
  });

  it('틀린 코드는 400 INVALID 이고, 5번 틀리면 맞는 코드도 EXPIRED 다', async () => {
    await api.auth.requestEmailVerification({ email: 'b@example.com' });
    for (let i = 0; i < 5; i += 1)
    await expect(api.auth.confirmEmailVerification({ email: 'b@example.com', code: '000000' })).rejects.toMatchObject({
      code: 'INVALID_VERIFICATION_CODE'
    });
    await expect(api.auth.confirmEmailVerification({ email: 'b@example.com', code: '123456' })).rejects.toMatchObject({
      code: 'VERIFICATION_CODE_EXPIRED'
    });
  });

  it('다른 이메일의 토큰이나 짧은 비밀번호로는 가입하지 못한다', async () => {
    await api.auth.requestEmailVerification({ email: 'c@example.com' });
    const { verificationToken } = await api.auth.confirmEmailVerification({ email: 'c@example.com', code: '123456' });
    await expect(
      api.auth.signup({ email: 'd@example.com', password: 'longenough1!', verificationToken })
    ).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    await expect(
      api.auth.signup({ email: 'c@example.com', password: 'short', verificationToken })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(api.users.me()).rejects.toMatchObject({ status: 401 });
  });

  it('카카오 계정은 email 이 null 이다', async () => {
    await api.auth.kakao({ code: 'any-code' });
    expect(await api.users.me()).toMatchObject({ email: null, role: 'USER' });
  });

  it('규칙에 맞지 않는 비밀번호는 이유를 message 에 담아 400 이다', async () => {
    await api.auth.requestEmailVerification({ email: 'e@example.com' });
    const { verificationToken } = await api.auth.confirmEmailVerification({ email: 'e@example.com', code: '123456' });
    await expect(
      api.auth.signup({ email: 'e@example.com', password: 'longenough', verificationToken })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: '숫자, 기호를 하나 이상 넣어 주세요.' });
  });
});

describe('비밀번호 재설정과 변경 (목업, #270)', () => {
  it('코드 받기 → 확인 → 새 비밀번호로 바꾸면 그 비밀번호로 들어온다', async () => {
    await api.auth.requestPasswordReset({ email: 'r@example.com' });
    const { verificationToken } = await api.auth.confirmPasswordReset({ email: 'r@example.com', code: '123456' });
    // 규칙에 맞지 않으면 토큰은 그대로라 고쳐서 다시 보낸다
    await expect(
      api.auth.completePasswordReset({ email: 'r@example.com', verificationToken, newPassword: 'short' })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await api.auth.completePasswordReset({ email: 'r@example.com', verificationToken, newPassword: 'newpass1!' });
    // 바꾸고 나면 토큰은 더 쓸 수 없다
    await expect(
      api.auth.completePasswordReset({ email: 'r@example.com', verificationToken, newPassword: 'other12!' })
    ).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    await api.auth.login({ email: 'r@example.com', password: 'newpass1!' });
    expect((await api.users.me()).email).toBe('r@example.com');
  });

  it('가입 인증 코드와 재설정 코드는 따로 센다', async () => {
    await api.auth.requestEmailVerification({ email: 's@example.com' });
    await expect(api.auth.requestPasswordReset({ email: 's@example.com' })).resolves.toBeUndefined();
    await expect(api.auth.requestPasswordReset({ email: 's@example.com' })).rejects.toMatchObject({
      code: 'VERIFICATION_RESEND_TOO_SOON'
    });
  });

  it('현재 비밀번호가 맞아야 바꾸고, 카카오 계정은 409 PASSWORD_NOT_SET 이다', async () => {
    await api.auth.login({ email: 'p@example.com', password: 'demo1234' });
    await expect(
      api.users.changePassword({ currentPassword: 'wrong', newPassword: 'newpass1!' })
    ).rejects.toMatchObject({ code: 'INVALID_CURRENT_PASSWORD' });
    await api.users.changePassword({ currentPassword: 'demo1234', newPassword: 'newpass1!' });
    await api.auth.logout();
    await api.auth.login({ email: 'p@example.com', password: 'newpass1!' });

    await api.auth.kakao({ code: 'any-code' });
    await expect(
      api.users.changePassword({ currentPassword: 'x', newPassword: 'newpass1!' })
    ).rejects.toMatchObject({ status: 409, code: 'PASSWORD_NOT_SET' });
  });

  it('버그 신고는 로그인해야 받고 한 시간에 5건까지다', async () => {
    await expect(api.bugReports.create({ message: '금액이 0원' })).rejects.toMatchObject({ status: 401 });
    await api.auth.login({ email: 'q@example.com', password: 'demo1234' });
    for (let i = 0; i < 5; i += 1) await api.bugReports.create({ message: `신고 ${i}` });
    await expect(api.bugReports.create({ message: '여섯 번째' })).rejects.toMatchObject({
      status: 429,
      code: 'BUG_REPORT_RATE_LIMITED'
    });
  });
});

describe('내보내기 (#214)', () => {
  it('현재 판정 전부와 답한 내용을 주고, 스코프가 하나가 아니면 400 이다', async () => {
    const group = await groupOf(tx('1005'));
    await api.questions.respond({ questionIds: group.questionIds, answer: { value: '업무미팅' } });

    const { items } = await api.judgments.export({ batchId });
    const summary = await api.judgments.summary({ batchId });
    expect(items).toHaveLength(summary.totalCount);
    const row = items.find((item) => item.judgment.transactionId === tx('1005'));
    expect(row?.answers).toEqual([{ question: group.questionText, answer: '업무미팅' }]);
    expect(row?.allowedAmount).toBe(row?.judgment.finalAmount ?? 0);

    await expect(api.judgments.export({} as never)).rejects.toMatchObject({ status: 400, code: 'INVALID_EXPORT_SCOPE' });
  });

  it('자택 관리비는 작업 공간이 따로 나뉜다고 답하면 문진의 면적 비율만큼 인정한다 (R-103 v3)', async () => {
    const group = await groupOf(tx('1008'));
    expect(group.options).toEqual(['사업 전용', '자택 겸용(작업 공간이 따로 나뉨)', '자택 겸용(따로 나뉘지 않음)']);
    await api.questions.respond({ questionIds: group.questionIds, answer: { value: '자택 겸용(작업 공간이 따로 나뉨)' } });
    const judgment = await currentOf(tx('1008'));
    const amount = (await api.transactions.get(tx('1008'))).amount;
    expect(judgment.verdict.code).toBe('AVAILABLE');
    // 시드 문진의 면적 비율은 20% 다
    expect(judgment.finalAmount).toBe(Math.floor(amount * 20 / 100));
  });

  it('문진의 면적 비율이 0(해당 없음)이면 엔진처럼 비율이 없는 것으로 보고 확인 필요로 둔다', async () => {
    const context = await api.contexts.create({
      industryCode: '940909',
      prevYearRevenue: 1,
      businessOpenDate: '2024-01-01',
      bookkeepingDuty: '간편장부',
      hasEmployee: false,
      homeOfficeRatio: 0
    });
    let run = await api.runs.create({ batchId, contextId: context.id });
    while (run.status.code !== 'COMPLETED') run = await api.runs.get(run.id);
    const group = await groupOf(tx('1008'));
    await api.questions.respond({ questionIds: group.questionIds, answer: { value: '자택 겸용(작업 공간이 따로 나뉨)' } });
    const judgment = await currentOf(tx('1008'));
    expect(judgment.verdict.code).toBe('NEEDS_REVIEW');
    expect(judgment.finalAmount).toBeNull();
  });
});
