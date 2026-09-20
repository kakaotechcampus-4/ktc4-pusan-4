import type { Citation, Coded, GateId, Verdict } from '../types/domain';

/**
 * 랜딩 히어로 데모 전용. 게이트 통과 기록은 API 판정 응답에 없어(명세 4.3 #7)
 * 도메인 타입에 두지 않고 여기서만 쓴다.
 */
export interface GateTraceStep {
  gate: GateId;
  result: string;
}

export interface ShowcaseTrace {
  judgmentId: string;
  approvedAt: string;
  merchantRaw: string;
  merchantNorm: string;
  amount: number;
  verdict: Coded<Verdict>;
  blockedAtGate: GateId | null;
  gateTrace: GateTraceStep[];
  /** 데모용: 조문 제목까지 들고 있어 API 조회 없이 그린다 */
  citation: (Citation & { title: string }) | null;
}

export const SHOWCASE_TRACES: ShowcaseTrace[] = [
  {
    judgmentId: '0199f1c3-0000-7000-8000-00000000001001',
    approvedAt: '2026-01-03',
    merchantRaw: 'AWS APN1',
    merchantNorm: 'Amazon Web Services',
    amount: 137_000,
    verdict: {
      code: 'AVAILABLE',
      label: '가능'
    },
    blockedAtGate: null,
    gateTrace: [
      {
        gate: 'G0',
        result: '승인내역 확인 · 형식 검증 통과'
      },
      {
        gate: 'G1',
        result: '§33 불산입 항목 해당 없음'
      },
      {
        gate: 'G2',
        result: '통상성 인정 (업종 프로파일 62010)'
      },
      {
        gate: 'G3',
        result: '자산 아님 · 안분 대상 아님'
      },
      {
        gate: 'G4',
        result: '전액 137,000원 산입'
      },
      {
        gate: 'G5',
        result: '한도 버킷 해당 없음'
      },
      {
        gate: 'G6',
        result: '근거 조문 2건 부착'
      }
    ],
    citation: {
      statuteVersionId: 1418,
      statuteId: '소득세법-27-1',
      title: '소득세법 제27조 제1항'
    }
  },
  {
    judgmentId: '0199f1c3-0000-7000-8000-00000000001005',
    approvedAt: '2026-01-12',
    merchantRaw: '스타벅스코리아 서면점',
    merchantNorm: '스타벅스',
    amount: 12_800,
    verdict: {
      code: 'NEEDS_REVIEW',
      label: '확인 필요'
    },
    blockedAtGate: 'G2',
    gateTrace: [
      {
        gate: 'G0',
        result: '승인내역 확인'
      },
      {
        gate: 'G1',
        result: '불산입 항목 해당 없음'
      },
      {
        gate: 'G2',
        result: '목적 불명 → 확인 필요로 강등'
      }
    ],
    citation: {
      statuteVersionId: 1418,
      statuteId: '소득세법-27-1',
      title: '소득세법 제27조 제1항'
    }
  },
  {
    judgmentId: '0199f1c3-0000-7000-8000-00000000001020',
    approvedAt: '2026-01-28',
    merchantRaw: 'NETFLIX.COM',
    merchantNorm: 'Netflix',
    amount: 17_000,
    verdict: {
      code: 'UNAVAILABLE',
      label: '불가'
    },
    blockedAtGate: 'G2',
    gateTrace: [
      {
        gate: 'G0',
        result: '승인내역 확인'
      },
      {
        gate: 'G1',
        result: '해당 없음'
      },
      {
        gate: 'G2',
        result: '통상성 부정 → 불가'
      }
    ],
    citation: {
      statuteVersionId: 1418,
      statuteId: '소득세법-27-1',
      title: '소득세법 제27조 제1항'
    }
  }
];
