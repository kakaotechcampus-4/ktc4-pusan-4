import { describe, expect, it } from 'vitest';
import { formatDateTime, toKst } from './format';

describe('toKst', () => {
  it('Z 와 +09:00 이 같은 KST 로 읽힌다', () => {
    expect(toKst('2026-10-16T05:01:02Z')).toEqual({ date: '2026-10-16', time: '14:01' });
    expect(toKst('2026-10-16T14:01:02+09:00')).toEqual({ date: '2026-10-16', time: '14:01' });
  });

  it('KST 자정을 넘으면 날짜도 넘어간다', () => {
    expect(toKst('2026-10-16T15:30:00Z')).toEqual({ date: '2026-10-17', time: '00:30' });
    expect(toKst('2026-12-31T15:00:00Z')).toEqual({ date: '2027-01-01', time: '00:00' });
  });

  it('밀리초보다 긴 소수 초도 읽는다', () => {
    expect(toKst('2026-10-16T15:30:00.123456Z')).toEqual({ date: '2026-10-17', time: '00:30' });
    expect(toKst('2026-10-16T15:30:00.123456789Z')).toEqual({ date: '2026-10-17', time: '00:30' });
  });
});

describe('formatDateTime', () => {
  it('KST 날짜와 시:분을 잇는다', () => {
    expect(formatDateTime('2026-10-16T05:01:02Z')).toBe('2026-10-16 14:01');
  });
});
