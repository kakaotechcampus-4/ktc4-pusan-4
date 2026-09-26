const test = require('node:test');
const assert = require('node:assert/strict');
const { QuestionsService } = require('../dist/questions/questions.service');
const { BATCH_ID } = require('../dist/seed/seed-data');
const { SeedService } = require('../dist/seed/seed.service');
const { StoreService } = require('../dist/store/store.service');

function transaction(id, amount) {
  return {
    id,
    batchId: 'batch-1',
    approvedAt: '2026-01-01',
    merchantRaw: id,
    merchantNorm: id,
    merchantCategory: '기타',
    classificationStatus: 'CLASSIFIED',
    amount,
    installmentMonths: 0,
    naturalKey: `natural:${id}`,
    sourceStatus: 'JUDGEABLE',
    userInclusion: 'AUTO',
  };
}

function question(id, transactionId, status = 'PENDING', overrides = {}) {
  return {
    id,
    batchId: 'batch-1',
    transactionId,
    groupKey: `merchant:${transactionId}`,
    factType: '용도',
    questionText: '사업용인가요?',
    options: ['사업', '개인'],
    status,
    answeredFactId: null,
    createdAt: '2026-01-01T00:00:00+09:00',
    answeredAt: null,
    ...overrides,
  };
}

test('질문 목록은 페이지와 별도로 미해소 질문 수와 중복 없는 거래 금액을 반환한다', () => {
  const store = new StoreService();
  store.transactions.push(transaction('tx-1', 1000), transaction('tx-2', 2000));
  store.questions.push(
    question('q-1', 'tx-1'),
    question('q-2', 'tx-1'),
    question('q-3', 'tx-2', 'ANSWERED'),
  );
  const service = new QuestionsService(store);

  const result = service.list({ status: 'ANSWERED', page: 0, size: 1 });

  assert.deepEqual(result.unresolved, { count: 2, amount: 1000 });
});

test('질문 일괄 응답은 같은 batch와 factType의 미해소 질문만 처리한다', () => {
  const store = new StoreService();
  store.users.push({ id: 'user-1', email: 'user@example.com', createdAt: '2026-01-01T00:00:00+09:00' });
  store.uploadBatches.push({ id: 'batch-1', userId: 'user-1' });
  store.transactions.push(
    transaction('tx-1', 1000),
    transaction('tx-2', 2000),
    transaction('tx-3', 3000),
  );
  store.questions.push(
    question('q-1', 'tx-1'),
    question('q-2', 'tx-2'),
    question('q-3', 'tx-3', 'PENDING', { factType: '안분비율', options: ['20%', '50%'] }),
  );
  const service = new QuestionsService(store);

  const result = service.bulkAnswer('batch-1', '용도', '개인');

  assert.deepEqual(
    {
      answeredCount: result.answeredCount,
      skippedCount: result.skippedCount,
      factCount: result.factIds.length,
      rejudgedTransactionCount: result.rejudgedTransactionCount,
      unresolved: result.unresolved,
      statuses: store.questions.map((q) => q.status),
    },
    {
      answeredCount: 2,
      skippedCount: 1,
      factCount: 2,
      rejudgedTransactionCount: 2,
      unresolved: { count: 1, amount: 3000 },
      statuses: ['ANSWERED', 'ANSWERED', 'PENDING'],
    },
  );
});

test('이미 답변한 질문을 정정하면 UserFact를 덮어쓰지 않고 새 version을 만든다', () => {
  const store = new StoreService();
  store.users.push({ id: 'user-1', email: 'user@example.com', createdAt: '2026-01-01T00:00:00+09:00' });
  store.transactions.push(transaction('tx-1', 1000));
  store.userFacts.push({
    id: 'fact-1',
    userId: 'user-1',
    batchId: 'batch-1',
    scopeKey: 'merchant:tx-1',
    factType: '용도',
    value: '개인',
    version: 1,
    createdAt: '2026-01-01T00:00:00+09:00',
  });
  store.questions.push(
    question('q-1', 'tx-1', 'ANSWERED', {
      answeredFactId: 'fact-1',
      answeredAt: '2026-01-01T00:00:00+09:00',
    }),
  );
  const service = new QuestionsService(store);

  const result = service.respond(['q-1'], '사업');

  assert.deepEqual(
    {
      factId: result.factId,
      versions: store.userFacts.map((fact) => fact.version),
      values: store.userFacts.map((fact) => fact.value),
      currentFactId: store.questions[0].answeredFactId,
    },
    {
      factId: store.userFacts[1].id,
      versions: [1, 2],
      values: ['개인', '사업'],
      currentFactId: store.userFacts[1].id,
    },
  );
});

test('같은 factType의 시드 질문은 하나의 값으로 일괄 응답할 수 있다', () => {
  const store = new StoreService();
  new SeedService(store).onModuleInit();
  const service = new QuestionsService(store);

  const result = service.bulkAnswer(BATCH_ID, '용도', '개인');

  assert.deepEqual(
    {
      answeredCount: result.answeredCount,
      skippedCount: result.skippedCount,
      unresolved: result.unresolved.count,
    },
    { answeredCount: 3, skippedCount: 3, unresolved: 3 },
  );
});
