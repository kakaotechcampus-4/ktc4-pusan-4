const test = require('node:test');
const assert = require('node:assert/strict');
const { JudgmentRunsService } = require('../dist/judgment-runs/judgment-runs.service');
const { StoreService } = require('../dist/store/store.service');

test('EXCLUDED 거래를 INCLUDED로 바꾸면 judgment run 대상에 포함한다', () => {
  const store = new StoreService();
  store.uploadBatches.push({ id: 'batch-1' });
  store.contexts.push({ id: 'context-1', version: 1 });
  store.transactions.push({
    id: 'tx-1',
    batchId: 'batch-1',
    sourceStatus: 'EXCLUDED',
    userInclusion: 'INCLUDED',
    classificationStatus: 'CLASSIFIED',
    merchantCategory: '카페',
    amount: 1000,
  });

  const result = new JudgmentRunsService(store).create('batch-1', 'context-1');

  assert.equal(result.totalCount, 1);
});
