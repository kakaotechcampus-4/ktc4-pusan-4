import { createHash, randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fileHash, naturalKey, sha256Hex } from './hash';
import { MEDICAL_PREFIX, ParserError } from './primitives';

const bytes = (text: string) => new TextEncoder().encode(text);

describe('sha256Hex', () => {
  it('표준 시험 벡터와 같다', async () => {
    expect(await sha256Hex(bytes('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(await sha256Hex(bytes(''))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('큰 입력도 node:crypto 와 같다', async () => {
    const data = randomBytes(1024 * 1024);
    expect(await sha256Hex(new Uint8Array(data))).toBe(createHash('sha256').update(data).digest('hex'));
  });
});

describe('fileHash', () => {
  it('sha256: 접두어를 붙인다', async () => {
    const data = bytes('card file');
    expect(await fileHash(data.buffer as ArrayBuffer)).toBe(
      `sha256:${createHash('sha256').update('card file').digest('hex')}`
    );
  });
});

describe('naturalKey', () => {
  it('Python natural_key 와 같은 값이다', async () => {
    expect(await naturalKey('2026-01-03', '스타벅스코리아 서면점', 11000, '78968731')).toBe('721607a430d35bfd');
    expect(await naturalKey('2026-01-03', '스타벅스코리아 서면점', 11000, '')).toBe('85a0642d2d48fe09');
    expect(await naturalKey('2026-01-12', '쿠팡', -39000, '20000009')).toBe('b9119080c84cc753');
  });

  it('의료 업종은 원래 상호 대신 의료_마스킹 으로 키를 만든다', async () => {
    expect(await naturalKey('2026-01-05', MEDICAL_PREFIX, 15000, '10000002')).toBe('65d6a6efc6f1a70f');
  });

  it('날짜나 금액이 없으면 키를 만들지 않는다', async () => {
    expect(await naturalKey('', '쿠팡', 39000, '1')).toBe('');
    expect(await naturalKey('2026-01-12', '쿠팡', null, '1')).toBe('');
  });

  describe('WebCrypto 를 쓸 수 없는 환경', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('HASH_UNAVAILABLE 로 알린다', async () => {
      vi.stubGlobal('crypto', {});
      await expect(naturalKey('2026-01-12', '쿠팡', 39000, '1')).rejects.toMatchObject({
        name: 'ParserError',
        code: 'HASH_UNAVAILABLE'
      });
      await expect(sha256Hex(bytes('abc'))).rejects.toBeInstanceOf(ParserError);
    });
  });
});
