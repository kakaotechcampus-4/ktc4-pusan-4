const test = require('node:test');
const assert = require('node:assert/strict');
const { ClassificationService } = require('../dist/classification/classification.service');
const { StoreService } = require('../dist/store/store.service');

test('완료되지 않은 judgment run만 있으면 분류 응답에서 재판정하지 않는다', () => {
  const store = new StoreService();
  store.transactions.push({
    id: 'tx-1',
    batchId: 'batch-1',
    merchantCategory: '미분류',
    classificationStatus: 'NEEDS_REVIEW',
    amount: 1000,
  });
  store.classificationReviews.push({
    id: 'review-1',
    batchId: 'batch-1',
    transactionId: 'tx-1',
    merchantRaw: '알 수 없는 가맹점',
    merchantNorm: '알 수 없는 가맹점',
    status: 'PENDING',
    suggestedCategories: [],
    createdAt: '2026-01-01T00:00:00+09:00',
    resolvedAt: null,
  });
  store.judgmentRuns.push({
    id: 'run-1',
    batchId: 'batch-1',
    contextVersion: 1,
    startedAt: '2026-01-01T00:00:00+09:00',
    completedAt: null,
  });

  const result = new ClassificationService(store).respond(['review-1'], '카페');

  assert.equal(result.judgedCount, 0);
  assert.equal(store.judgments.length, 0);
});
