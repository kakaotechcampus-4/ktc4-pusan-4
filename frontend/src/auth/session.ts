import type { UploadBatch } from '../types/domain';

/**
 * 로그인이 사용자 손을 거치지 않고 끝난 이유. 로그인 화면이 한 줄로 알린다 (C51·C44·C45)
 * - expired: 재발급까지 401 이다
 * - account-changed: 다른 탭에서 다른 계정으로 로그인했다. 리프레시 쿠키는 호스트마다 하나라 이 탭도 그 계정이 된다
 * - signed-out: 다른 탭에서 로그아웃했다
 */
export type SessionEndReason = 'expired' | 'account-changed' | 'signed-out';

const batchKey = (userId: string) => `preet:batch:${userId}`;

/**
 * 사용자가 고른 업로드를 계정마다 기억한다. 새로고침이나 다시 로그인해도 보던 업로드로 돌아온다 (C40).
 * 저장소를 막아 둔 브라우저에서는 읽기·쓰기가 던진다. 그때는 기억하지 않는다
 */
export function savedBatchId(userId: string): string | null {
  try {
    return localStorage.getItem(batchKey(userId));
  } catch {
    return null;
  }
}

export function saveBatchId(userId: string, batchId: string | null) {
  try {
    if (batchId) localStorage.setItem(batchKey(userId), batchId);
    else localStorage.removeItem(batchKey(userId));
  } catch {
    // 기억하지 못해도 지금 화면은 그대로 쓴다
  }
}

/**
 * 로그인 뒤 볼 업로드. 기억해 둔 것이 아직 있으면 그것, 없으면 거래가 든 가장 최근 것, 그것도 없으면 가장 최근 것이다.
 * 이미 올린 거래만 든 파일은 0건 업로드가 되므로 가장 최근 것을 그냥 고르면 모든 화면이 비어 보인다 (C40).
 * items 는 3.3 목록 순서(createdAt DESC) 그대로다
 */
export function chooseBatch(
items: Pick<UploadBatch, 'id' | 'transactionCount'>[],
savedId: string | null)
: string | null {
  if (savedId && items.some((batch) => batch.id === savedId)) return savedId;
  return (items.find((batch) => batch.transactionCount > 0) ?? items[0])?.id ?? null;
}
