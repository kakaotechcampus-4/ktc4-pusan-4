const test = require('node:test');
const assert = require('node:assert/strict');
const { JudgmentsService } = require('../dist/judgments/judgments.service');
const { StoreService } = require('../dist/store/store.service');
const { TransactionsService } = require('../dist/transactions/transactions.service');

function judgment(overrides) {
  return {
    id: 'judgment-1',
    transactionId: 'tx-1',
    revision: 1,
    origin: { type: 'RUN', id: 'run-1' },
    runId: 'run-1',
    verdict: 'AVAILABLE',
    blockedAtGate: null,
    account: '소모품비',
    finalAmount: 1000,
    isInference: false,
    unmatchedReason: null,
    attributes: {},
    ruleCardId: 'R-1',
    ruleCardVersion: 1,
    appliedRuleIds: ['R-1'],
    rulesCommitSha: 'abc',
    userContextVersion: 1,
    explanation: null,
    computedAt: '2026-01-01T00:00:00+09:00',
    citations: [],
    ...overrides,
  };
}

test('활성 override는 이후 자동 판정보다 현재 결과에서 우선한다', () => {
  const store = new StoreService();
  store.judgments.push(judgment());
  const service = new JudgmentsService(store);
  const overridden = service.override('judgment-1', 'UNAVAILABLE', '개인 비용');
  store.judgments.push(
    judgment({
      id: 'judgment-3',
      revision: 3,
      origin: { type: 'RUN', id: 'run-2' },
      runId: 'run-2',
      computedAt: '2026-01-02T00:00:00+09:00',
    }),
  );

  const current = service.list({ transactionId: 'tx-1' }).items[0];

  assert.equal(current.id, overridden.id);
});

test('override를 해제하면 최신 자동 판정이 현재 결과가 된다', () => {
  const store = new StoreService();
  store.judgments.push(judgment());
  const service = new JudgmentsService(store);
  const overridden = service.override('judgment-1', 'UNAVAILABLE', '개인 비용');
  store.judgments.push(
    judgment({
      id: 'judgment-3',
      revision: 3,
      origin: { type: 'RUN', id: 'run-2' },
      runId: 'run-2',
      computedAt: '2026-01-02T00:00:00+09:00',
    }),
  );

  service.releaseOverride(overridden.origin.id);
  const current = service.list({ transactionId: 'tx-1' }).items[0];

  assert.equal(current.id, 'judgment-3');
});

test('새 override는 기존 활성 override를 대체한다', () => {
  const store = new StoreService();
  store.judgments.push(judgment());
  const service = new JudgmentsService(store);
  const first = service.override('judgment-1', 'UNAVAILABLE', '첫 수정');
  const second = service.override(first.id, 'NEEDS_REVIEW', '두 번째 수정');

  service.releaseOverride(second.origin.id);
  const current = service.list({ transactionId: 'tx-1' }).items[0];

  assert.equal(current.id, 'judgment-1');
});

test('거래 verdict 필터는 활성 override 판정을 사용한다', () => {
  const store = new StoreService();
  store.transactions.push({
    id: 'tx-1',
    batchId: 'batch-1',
    approvedAt: '2026-01-01',
    merchantRaw: '가맹점',
    merchantNorm: '가맹점',
    merchantCategory: '기타',
    classificationStatus: 'CLASSIFIED',
    amount: 1000,
    installmentMonths: 0,
    sourceStatus: 'JUDGEABLE',
    userInclusion: 'AUTO',
  });
  store.judgments.push(judgment());
  const judgments = new JudgmentsService(store);
  judgments.override('judgment-1', 'UNAVAILABLE', '개인 비용');
  store.judgments.push(judgment({ id: 'judgment-3', revision: 3 }));

  const result = new TransactionsService(store).list({ verdict: 'UNAVAILABLE' });

  assert.equal(result.items.length, 1);
});
