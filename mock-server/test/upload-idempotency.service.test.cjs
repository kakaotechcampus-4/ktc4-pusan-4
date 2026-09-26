const test = require('node:test');
const assert = require('node:assert/strict');
const { UploadBatchesService } = require('../dist/upload-batches/upload-batches.service');
const { StoreService } = require('../dist/store/store.service');

function uploadRequest(fileHash = 'sha256:file-1') {
  return {
    sourceType: '승인내역',
    cardIssuer: '국민',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    fileHash,
    transactions: [
      {
        approvedAt: '2026-01-01',
        merchantRaw: 'AWS APN1',
        amount: 1000,
        naturalKey: `natural:${fileHash}`,
        status: 'JUDGEABLE',
      },
    ],
  };
}

function serviceWithUser() {
  const store = new StoreService();
  store.users.push({ id: 'user-1', email: 'user@example.com', createdAt: '2026-01-01T00:00:00+09:00' });
  return { store, service: new UploadBatchesService(store) };
}

test('멱등 요청으로 생성된 batch가 삭제되면 TTL 동안 410을 반환한다', () => {
  const { service } = serviceWithUser();
  const dto = uploadRequest();
  const created = service.create(dto, 'key-1');
  service.remove(created.id);

  const replay = () => service.create(dto, 'key-1');

  assert.throws(
    replay,
    (error) => error.getStatus() === 410 && error.getResponse().code === 'IDEMPOTENCY_RESULT_DELETED',
  );
});

test('삭제된 멱등 기록의 24시간 TTL이 지나면 새 batch를 생성한다', () => {
  const { store, service } = serviceWithUser();
  const dto = uploadRequest();
  const first = service.create(dto, 'key-1');
  service.remove(first.id);
  store.idempotencyRecords.get('key-1').expiresAt = Date.now() - 1;

  const recreated = service.create(dto, 'key-1');

  assert.notEqual(recreated.id, first.id);
});
