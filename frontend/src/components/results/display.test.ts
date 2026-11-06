import { describe, expect, it } from 'vitest';
import type { Judgment, Verdict } from '../../types/domain';
import {
  MASKED_MEDICAL,
  attributeRows,
  bookingNote,
  formatStamp,
  merchantTitle,
  unavailableReason,
  verdictNote } from
'./display';

const judgment = (patch: {
  verdict?: Verdict;
  origin?: Judgment['origin']['type'];
  blockedAtGate?: Judgment['blockedAtGate'];
  outOfScope?: boolean;
} = {}) =>
({
  verdict: { code: patch.verdict ?? 'UNAVAILABLE', label: '' },
  origin: { type: patch.origin ?? 'RUN', id: null },
  blockedAtGate: patch.blockedAtGate ?? null,
  outOfScope: patch.outOfScope ?? false
}) as unknown as Judgment;

describe('merchantTitle', () => {
  it('정규화 이름이 아니라 카드에 찍힌 이름을 쓴다', () => {
    expect(merchantTitle({ merchantRaw: 'FIGMA.COM', merchantNorm: 'FIGMACOM' })).toBe('FIGMA.COM');
    expect(merchantTitle({ merchantRaw: ' 온새미로 공방 ', merchantNorm: '온새미로공방' })).toBe('온새미로 공방');
  });

  it('가린 의료기관은 번호 대신 중립 이름이다', () => {
    expect(merchantTitle({ merchantRaw: '의료_마스킹_01', merchantNorm: '의료마스킹01' })).toBe(MASKED_MEDICAL);
  });

  it('카드에 찍힌 이름이 비어 있으면 정규화 이름으로 둔다', () => {
    expect(merchantTitle({ merchantRaw: '', merchantNorm: '가게' })).toBe('가게');
  });
});

describe('verdictNote', () => {
  it('답을 기다리는 불가는 답변 대기다', () => {
    expect(verdictNote(judgment(), true)).toBe('답변 대기');
    expect(verdictNote(judgment(), false)).toBeNull();
  });

  it('확인 필요에는 답변 대기를 붙이지 않는다', () => {
    expect(verdictNote(judgment({ verdict: 'NEEDS_REVIEW' }), true)).toBeNull();
  });

  it('직접 바꾼 판정은 질문이 남아도 직접 수정이다', () => {
    expect(verdictNote(judgment({ origin: 'OVERRIDE' }), true)).toBe('직접 수정');
  });

  it('범위 밖이면 세무사에게 넘김이다', () => {
    expect(verdictNote(judgment({ verdict: 'NEEDS_REVIEW', outOfScope: true }), false)).toBe('세무사에게 넘김');
  });
});

describe('unavailableReason', () => {
  it('막힌 단계를 내부 코드 대신 문장으로 쓴다', () => {
    expect(unavailableReason(judgment({ blockedAtGate: 'G1' }))).toBe('법이 필요경비에 넣지 못하게 정한 지출입니다.');
    expect(unavailableReason(judgment({ blockedAtGate: 'G2' }))).toBe('업무에 쓴 지출로 보기 어려워 경비에서 뺐습니다.');
  });

  it('답으로 불가가 됐으면 답을 이유로 든다', () => {
    expect(unavailableReason(judgment({ blockedAtGate: 'G2', origin: 'USER_FACT' }))).toMatch(/^답하신 내용으로는/);
  });

  it('불가가 아니거나 이유를 댈 수 없으면 null 이다', () => {
    expect(unavailableReason(judgment({ verdict: 'AVAILABLE', blockedAtGate: 'G2' }))).toBeNull();
    expect(unavailableReason(judgment())).toBeNull();
  });

  it('문장에 게이트 번호가 없다', () => {
    for (const gate of ['G1', 'G2'] as const)
    expect(unavailableReason(judgment({ blockedAtGate: gate }))).not.toMatch(/G\d|게이트/);
  });
});

describe('attributeRows', () => {
  it('사람이 읽을 이름이 있는 속성만 우리 말 값으로 보여 준다', () => {
    expect(
      attributeRows({
        증빙필요: true,
        증빙수취: true,
        증빙: '카드매출전표',
        가산세_대상: false,
        즉시상각_가능: true,
        즉시상각_근거: '시행령67-7',
        즉시상각: true,
        limit_bucket: '접대비',
        merchantCategory: '음식점'
      })
    ).toEqual([
    { label: '증빙', value: '카드매출전표' },
    { label: '증빙불비 가산세', value: '대상 아님' },
    { label: '즉시상각', value: '올해 경비로 처리' },
    { label: '연간 한도', value: '접대비' }]
    );
  });

  it('자산과 안분 값을 풀어 쓴다', () => {
    expect(attributeRows({ 자산: true, 상각방법: '정률법', 내용연수: 5, 안분: '작업공간비율' })).toEqual([
    { label: '감가상각', value: '자산으로 나눠 처리' },
    { label: '상각 방법', value: '정률법' },
    { label: '내용연수', value: '5년' },
    { label: '업무 비율', value: '작업 공간 면적 비율만큼' }]
    );
  });

  it('모르는 값이나 거짓 값은 빼고, 밑줄 든 키가 화면에 남지 않는다', () => {
    const rows = attributeRows({ 즉시상각: false, 안분: '다른값', 자산대장_등재: true, 자산유형: '무형자산_소프트웨어' });
    expect(rows).toEqual([]);
  });
});

describe('bookingNote', () => {
  it('장부 안내 문장만 꺼낸다', () => {
    expect(bookingNote({ 계상_안내: '그해 장부에 계상해야 합니다' })).toBe('그해 장부에 계상해야 합니다');
    expect(bookingNote({})).toBeNull();
  });
});

describe('formatStamp', () => {
  it('날짜는 다른 화면과 같은 꼴이고 KST 시:분을 붙인다', () => {
    expect(formatStamp('2026-11-05T12:22:00Z')).toBe('2026. 11. 05 21:22');
  });
});
