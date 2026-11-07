import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseBatch, saveBatchId, savedBatchId } from './session';

describe('chooseBatch', () => {
  const items = [
  { id: 'empty-new', transactionCount: 0 },
  { id: 'full', transactionCount: 6 },
  { id: 'old', transactionCount: 11 }];


  it('기억해 둔 업로드가 아직 있으면 그것을 고른다', () => {
    expect(chooseBatch(items, 'old')).toBe('old');
  });

  it('기억해 둔 업로드가 지워졌으면 거래가 든 가장 최근 것을 고른다', () => {
    expect(chooseBatch(items, 'deleted')).toBe('full');
    expect(chooseBatch(items, null)).toBe('full');
  });

  it('모두 0건이면 가장 최근 것, 업로드가 없으면 null 이다', () => {
    expect(chooseBatch([{ id: 'a', transactionCount: 0 }, { id: 'b', transactionCount: 0 }], null)).toBe('a');
    expect(chooseBatch([], 'deleted')).toBeNull();
  });
});

describe('고른 업로드 기억', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const memoryStorage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key)
    };
  };

  it('계정마다 따로 기억하고, null 이면 지운다', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    saveBatchId('u1', 'b1');
    saveBatchId('u2', 'b2');
    expect(savedBatchId('u1')).toBe('b1');
    expect(savedBatchId('u2')).toBe('b2');
    saveBatchId('u1', null);
    expect(savedBatchId('u1')).toBeNull();
  });

  it('저장소를 쓸 수 없으면 기억하지 않고 던지지도 않는다', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(() => saveBatchId('u1', 'b1')).not.toThrow();
    expect(savedBatchId('u1')).toBeNull();
  });
});
