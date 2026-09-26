import type {
  ClassificationReview,
  Judgment,
  JudgmentRun,
  JudgmentSummary,
  QuestionGroup,
  Transaction,
  UploadBatch,
  Verdict } from
'../../types/domain';

/** 백엔드 준비 전 목업. 모양은 API 명세 3.3~3.7 응답과 같다. */

export const UPLOAD_BATCH: UploadBatch = {
  id: '0199c8f2-0000-7000-8000-000000000001',
  sourceType: '승인내역',
  cardIssuer: '국민',
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  transactionCount: 292,
  skippedDuplicateCount: 0,
  classificationPendingCount: 6,
  createdAt: '2026-09-12T13:58:00+09:00'
};

export const JUDGMENT_RUN: JudgmentRun = {
  id: '0199e5b2-0000-7000-8000-000000000001',
  status: {
    code: 'COMPLETED',
    label: '완료'
  },
  totalCount: 292,
  processedCount: 292,
  failedCount: 0,
  startedAt: '2026-09-12T14:01:00+09:00',
  completedAt: '2026-09-12T14:05:00+09:00'
};

export const JUDGMENT_SUMMARY: JudgmentSummary = {
  scope: {
    type: 'RUN',
    id: '0199e5b2-0000-7000-8000-000000000001'
  },
  totalCount: 292,
  byVerdict: {
    AVAILABLE: {
      count: 168,
      finalAmount: 21_483_000
    },
    UNAVAILABLE: {
      count: 53,
      finalAmount: 0
    },
    NEEDS_REVIEW: {
      count: 71,
      finalAmount: 0
    }
  },
  byAccount: [
    {
      account: '지급수수료',
      count: 61,
      finalAmount: 9_120_000
    },
    {
      account: '소모품비',
      count: 42,
      finalAmount: 1_820_000
    },
    {
      account: '여비교통비',
      count: 38,
      finalAmount: 640_000
    },
    {
      account: '도서인쇄비',
      count: 27,
      finalAmount: 903_000
    }
  ]
};

export const TRANSACTIONS: Transaction[] = [
  {
    id: '0199c8f2-0000-7000-8000-00000000001001',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-03',
    merchantRaw: 'AWS APN1',
    merchantNorm: 'Amazon Web Services',
    merchantCategory: '클라우드 서비스',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 137_000,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001002',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-05',
    merchantRaw: 'GITHUB INC',
    merchantNorm: 'GitHub',
    merchantCategory: '소프트웨어',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 27_500,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001003',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-08',
    merchantRaw: '(주)한국애플 온라인',
    merchantNorm: 'Apple 대한민국',
    merchantCategory: '전자기기',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 3_490_000,
    installmentMonths: 12,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001004',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-10',
    merchantRaw: 'ADOBE SYSTEMS SOFTWARE',
    merchantNorm: 'Adobe',
    merchantCategory: '소프트웨어',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 660_000,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001005',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-12',
    merchantRaw: '스타벅스코리아 서면점',
    merchantNorm: '스타벅스',
    merchantCategory: '카페',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 12_800,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001006',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-14',
    merchantRaw: '카카오모빌리티',
    merchantNorm: '카카오 T',
    merchantCategory: '교통',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 9400,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001007',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-15',
    merchantRaw: 'SKT 이용요금',
    merchantNorm: 'SK텔레콤',
    merchantCategory: '통신비',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 78_000,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001008',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-16',
    merchantRaw: '(주)이지스자산관리 관리비',
    merchantNorm: '자택 관리비',
    merchantCategory: '주거·시설',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 184_000,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001009',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-17',
    merchantRaw: '이마트 하단점',
    merchantNorm: '이마트',
    merchantCategory: '대형마트',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 96_300,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001010',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-18',
    merchantRaw: '부산은퇴자골프클럽',
    merchantNorm: '골프장',
    merchantCategory: '여가·스포츠',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 240_000,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001011',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-19',
    merchantRaw: '서울대학교병원',
    merchantNorm: '병원',
    merchantCategory: '의료',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 62_000,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001012',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-20',
    merchantRaw: '국세청 국세납부',
    merchantNorm: '국세 납부',
    merchantCategory: '조세',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 1_240_000,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001013',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-21',
    merchantRaw: 'NOTION LABS INC',
    merchantNorm: 'Notion',
    merchantCategory: '소프트웨어',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 14_300,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001014',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-22',
    merchantRaw: '교보문고 광화문',
    merchantNorm: '교보문고',
    merchantCategory: '도서',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 38_000,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001015',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-23',
    merchantRaw: '위워크 서면 데스크',
    merchantNorm: 'WeWork',
    merchantCategory: '공간 임차',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 330_000,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001016',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-24',
    merchantRaw: '한우마을 본점',
    merchantNorm: '한우마을',
    merchantCategory: '접대·식음료',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 412_000,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001017',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-25',
    merchantRaw: 'GS25 대연동',
    merchantNorm: 'GS25',
    merchantCategory: '편의점',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 8600,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001018',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-26',
    merchantRaw: 'KTX 승차권 부산-서울',
    merchantNorm: '한국철도공사',
    merchantCategory: '교통',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 119_600,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001019',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-27',
    merchantRaw: '롯데백화점 상품권',
    merchantNorm: '백화점 상품권',
    merchantCategory: '상품권',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 500_000,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001020',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-28',
    merchantRaw: 'NETFLIX.COM',
    merchantNorm: 'Netflix',
    merchantCategory: '구독·미디어',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 17_000,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001021',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-29',
    merchantRaw: '오피스디포 데스크체어',
    merchantNorm: '오피스디포',
    merchantCategory: '사무용품',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 420_000,
    installmentMonths: 3,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001022',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-30',
    merchantRaw: '유니세프한국위원회',
    merchantNorm: '유니세프',
    merchantCategory: '기부금',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 300_000,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001023',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-31',
    merchantRaw: 'ELEVENLABS IO',
    merchantNorm: '미확인 가맹점',
    merchantCategory: '미분류',
    classificationStatus: {
      code: 'NEEDS_REVIEW',
      label: '분류 확인 필요'
    },
    amount: 33_000,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  },
  {
    id: '0199c8f2-0000-7000-8000-00000000001024',
    batchId: '0199c8f2-0000-7000-8000-000000000001',
    approvedAt: '2026-01-31',
    merchantRaw: 'SK에너지 대연주유소',
    merchantNorm: 'SK에너지',
    merchantCategory: '주유',
    classificationStatus: {
      code: 'CLASSIFIED',
      label: '분류 완료'
    },
    amount: 70_000,
    installmentMonths: 0,
    sourceStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    },
    userInclusion: 'AUTO',
    effectiveStatus: {
      code: 'JUDGEABLE',
      label: '판정대상'
    }
  }
];

export const JUDGMENTS: Judgment[] = [
  {
    id: '0199f1c3-0000-7000-8000-00000000001001',
    transactionId: '0199c8f2-0000-7000-8000-00000000001001',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'AVAILABLE',
      label: '가능'
    },
    outOfScope: false,
    blockedAtGate: null,
    account: '지급수수료',
    finalAmount: 137_000,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-209',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-209'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '소프트웨어 개발업(62010)에서 서비스 운영을 위한 클라우드 사용료는 사업 수행에 직접 대응하는 비용으로, 동일 업종에서 통상적으로 지출됩니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1418,
        statuteId: '소득세법-27-1'
      },
      {
        statuteVersionId: 1529,
        statuteId: '소득세법시행령-55-1-13'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001002',
    transactionId: '0199c8f2-0000-7000-8000-00000000001002',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'AVAILABLE',
      label: '가능'
    },
    outOfScope: false,
    blockedAtGate: null,
    account: '지급수수료',
    finalAmount: 27_500,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-143',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-143'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '개발 업무에 사용하는 코드 저장소 구독료로, 사업 수행에 직접 사용되는 용역의 대가에 해당합니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1418,
        statuteId: '소득세법-27-1'
      },
      {
        statuteVersionId: 1529,
        statuteId: '소득세법시행령-55-1-13'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001003',
    transactionId: '0199c8f2-0000-7000-8000-00000000001003',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'AVAILABLE',
      label: '가능'
    },
    outOfScope: false,
    blockedAtGate: null,
    account: '소모품비',
    finalAmount: 640_166,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-037',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-037'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '취득가액 100만원을 초과하는 사업용 자산으로 감가상각 대상입니다. 승인 기준 원금 전액을 취득가액으로 보고, 2026년 귀속분은 내용연수 5년 정액법 · 사업연도 중 11개월분만 산입합니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1523,
        statuteId: '소득세법시행령-55-1-7'
      },
      {
        statuteVersionId: 1544,
        statuteId: '소득세법시행령-62-1'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001004',
    transactionId: '0199c8f2-0000-7000-8000-00000000001004',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'NEEDS_REVIEW',
      label: '확인 필요'
    },
    outOfScope: false,
    blockedAtGate: 'G3',
    account: '지급수수료',
    finalAmount: null,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-225',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-225'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '연간 일시납 구독으로 보이나 서비스 제공 기간이 확인되지 않습니다. 기간이 다음 과세연도에 걸치면 선급비용으로 안분해야 하므로 전액 산입할 수 없습니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1418,
        statuteId: '소득세법-27-1'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001005',
    transactionId: '0199c8f2-0000-7000-8000-00000000001005',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'NEEDS_REVIEW',
      label: '확인 필요'
    },
    outOfScope: false,
    blockedAtGate: 'G2',
    account: '소모품비',
    finalAmount: null,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-142',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-142'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '1인 사업자의 단독 카페 이용은 세무 실무에서도 판단이 갈리는 항목입니다. 지출 목적이 확인되지 않아 단정하지 않고 확인 필요로 고정합니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1418,
        statuteId: '소득세법-27-1'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001006',
    transactionId: '0199c8f2-0000-7000-8000-00000000001006',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'NEEDS_REVIEW',
      label: '확인 필요'
    },
    outOfScope: false,
    blockedAtGate: 'G2',
    account: '여비교통비',
    finalAmount: null,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-320',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-320'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '이동 목적이 업무인지 사적인지 거래 내역만으로는 구분되지 않습니다. 목적 확인 후 재판정합니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1418,
        statuteId: '소득세법-27-1'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001007',
    transactionId: '0199c8f2-0000-7000-8000-00000000001007',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'NEEDS_REVIEW',
      label: '확인 필요'
    },
    outOfScope: false,
    blockedAtGate: 'G3',
    account: '소모품비',
    finalAmount: null,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-113',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-113'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '사업과 가사에 공통으로 관련되는 경비입니다. 사업 사용 비율이 객관적으로 구분되는 범위에서만 산입할 수 있으므로 안분율이 필요합니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1435,
        statuteId: '소득세법-33-1-5'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001008',
    transactionId: '0199c8f2-0000-7000-8000-00000000001008',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'NEEDS_REVIEW',
      label: '확인 필요'
    },
    outOfScope: false,
    blockedAtGate: 'G3',
    account: '소모품비',
    finalAmount: null,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-217',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-217'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '자택을 작업공간으로 사용한다고 문진에서 응답했습니다(면적 비율 20%). 다만 이 지출이 작업공간에 대응하는 부분인지 확인이 필요합니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1435,
        statuteId: '소득세법-33-1-5'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001009',
    transactionId: '0199c8f2-0000-7000-8000-00000000001009',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'UNAVAILABLE',
      label: '불가'
    },
    outOfScope: false,
    blockedAtGate: 'G1',
    account: null,
    finalAmount: null,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-177',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-177'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '직원이 없는 1인 사업자의 대형마트 식료품 구매는 가사에 관련되는 경비로 봅니다. 사업에 직접 관련되는 부분이 명백히 구분되지 않습니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1435,
        statuteId: '소득세법-33-1-5'
      },
      {
        statuteVersionId: 3480,
        statuteId: '대법원-2019두12345'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001010',
    transactionId: '0199c8f2-0000-7000-8000-00000000001010',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'UNAVAILABLE',
      label: '불가'
    },
    outOfScope: false,
    blockedAtGate: 'G1',
    account: null,
    finalAmount: null,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-340',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-340'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '업무와 관련 없는 지출로 열거된 항목에 해당합니다. 거래처 접대 사실이 확인되는 경우에도 접대비 한도 규정이 별도로 적용됩니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1447,
        statuteId: '소득세법-33-1-13'
      },
      {
        statuteVersionId: 1449,
        statuteId: '소득세법-33-1-14'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001011',
    transactionId: '0199c8f2-0000-7000-8000-00000000001011',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'UNAVAILABLE',
      label: '불가'
    },
    outOfScope: false,
    blockedAtGate: 'G1',
    account: null,
    finalAmount: null,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-046',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-046'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '본인 의료비는 가사 관련 경비로 필요경비에 산입하지 않습니다. 종합소득세 신고 시 의료비 세액공제 항목으로는 별도 검토할 수 있습니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1435,
        statuteId: '소득세법-33-1-5'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001012',
    transactionId: '0199c8f2-0000-7000-8000-00000000001012',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'UNAVAILABLE',
      label: '불가'
    },
    outOfScope: false,
    blockedAtGate: 'G1',
    account: null,
    finalAmount: null,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-302',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-302'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '소득세와 개인지방소득세는 필요경비 불산입 항목으로 법에 직접 열거되어 있습니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1431,
        statuteId: '소득세법-33-1-1'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001013',
    transactionId: '0199c8f2-0000-7000-8000-00000000001013',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'AVAILABLE',
      label: '가능'
    },
    outOfScope: false,
    blockedAtGate: null,
    account: '지급수수료',
    finalAmount: 14_300,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-225',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-225'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '업무 문서·일정 관리 도구 구독료로 사업에 직접 사용되는 용역의 대가에 해당합니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1418,
        statuteId: '소득세법-27-1'
      },
      {
        statuteVersionId: 1529,
        statuteId: '소득세법시행령-55-1-13'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001014',
    transactionId: '0199c8f2-0000-7000-8000-00000000001014',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'AVAILABLE',
      label: '가능'
    },
    outOfScope: false,
    blockedAtGate: null,
    account: '도서인쇄비',
    finalAmount: 38_000,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-346',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-346'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '업종과 직접 관련된 기술 서적 구입비로, 동일 업종에서 통상적으로 지출되는 비용입니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1418,
        statuteId: '소득세법-27-1'
      },
      {
        statuteVersionId: 2071,
        statuteId: '기본통칙-27-1'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001015',
    transactionId: '0199c8f2-0000-7000-8000-00000000001015',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'AVAILABLE',
      label: '가능'
    },
    outOfScope: false,
    blockedAtGate: null,
    account: '소모품비',
    finalAmount: 330_000,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-120',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-120'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '사업 수행 장소의 임차료로, 사업용 자산의 임차료 항목에 직접 해당합니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1529,
        statuteId: '소득세법시행령-55-1-13'
      },
      {
        statuteVersionId: 1418,
        statuteId: '소득세법-27-1'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001016',
    transactionId: '0199c8f2-0000-7000-8000-00000000001016',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'AVAILABLE',
      label: '가능'
    },
    outOfScope: false,
    blockedAtGate: null,
    account: '소모품비',
    finalAmount: 412_000,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-059',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-059'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '거래처 접대 목적이 확인된 지출로 접대비 버킷에 태그했습니다. 연말 한도 확정 시 초과분은 불산입으로 조정됩니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1449,
        statuteId: '소득세법-33-1-14'
      },
      {
        statuteVersionId: 1418,
        statuteId: '소득세법-27-1'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001017',
    transactionId: '0199c8f2-0000-7000-8000-00000000001017',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'NEEDS_REVIEW',
      label: '확인 필요'
    },
    outOfScope: false,
    blockedAtGate: 'G2',
    account: '소모품비',
    finalAmount: null,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-422',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-422'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '편의점 지출은 품목에 따라 업무 관련성이 달라집니다. 목적이 확인되지 않아 확인 필요로 둡니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1418,
        statuteId: '소득세법-27-1'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001018',
    transactionId: '0199c8f2-0000-7000-8000-00000000001018',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'AVAILABLE',
      label: '가능'
    },
    outOfScope: false,
    blockedAtGate: null,
    account: '여비교통비',
    finalAmount: 119_600,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-342',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-342'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '거래처 방문 사실이 이전 응답으로 저장되어 있어(사실 저장소) 업무 관련 여비로 판정했습니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1418,
        statuteId: '소득세법-27-1'
      },
      {
        statuteVersionId: 1529,
        statuteId: '소득세법시행령-55-1-13'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001019',
    transactionId: '0199c8f2-0000-7000-8000-00000000001019',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'UNAVAILABLE',
      label: '불가'
    },
    outOfScope: false,
    blockedAtGate: 'G1',
    account: null,
    finalAmount: null,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-208',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-208'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '상품권 구입 자체는 사용처가 확인되지 않아 업무 관련 지출로 볼 수 없습니다. 실제 사용 내역으로 별도 증빙이 필요합니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1447,
        statuteId: '소득세법-33-1-13'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001020',
    transactionId: '0199c8f2-0000-7000-8000-00000000001020',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'UNAVAILABLE',
      label: '불가'
    },
    outOfScope: false,
    blockedAtGate: 'G2',
    account: null,
    finalAmount: null,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-284',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-284'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '소프트웨어 개발업에서 영상 스트리밍 구독은 동일 업종의 통상적 지출로 인정되지 않습니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1418,
        statuteId: '소득세법-27-1'
      },
      {
        statuteVersionId: 2071,
        statuteId: '기본통칙-27-1'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001021',
    transactionId: '0199c8f2-0000-7000-8000-00000000001021',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'AVAILABLE',
      label: '가능'
    },
    outOfScope: false,
    blockedAtGate: null,
    account: '소모품비',
    finalAmount: 420_000,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-278',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-278'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '취득가액이 거래단위별 100만원 이하인 사무용 자산으로, 사용한 과세기간의 필요경비로 계상할 수 있습니다. 3개월 할부이나 승인 기준 원금 전액으로 봅니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1544,
        statuteId: '소득세법시행령-62-1'
      },
      {
        statuteVersionId: 1418,
        statuteId: '소득세법-27-1'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001022',
    transactionId: '0199c8f2-0000-7000-8000-00000000001022',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'NEEDS_REVIEW',
      label: '확인 필요'
    },
    outOfScope: false,
    blockedAtGate: 'G5',
    account: '소모품비',
    finalAmount: null,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-399',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-399'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '기부금 한도는 연간 소득금액이 확정된 후 계산됩니다. 현재는 잠정 상태로, 한도 초과분은 이후 과세기간으로 이월됩니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1462,
        statuteId: '소득세법-34-1'
      }
    ]
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001023',
    transactionId: '0199c8f2-0000-7000-8000-00000000001023',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'NEEDS_REVIEW',
      label: '확인 필요'
    },
    outOfScope: false,
    blockedAtGate: 'G2',
    account: '소모품비',
    finalAmount: null,
    isInference: true,
    unmatchedReason: 'MERCHANT_UNRESOLVED',
    attributes: {

    },
    ruleCardId: null,
    ruleCardVersion: null,
    appliedRuleIds: [],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: null,
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: []
  },
  {
    id: '0199f1c3-0000-7000-8000-00000000001024',
    transactionId: '0199c8f2-0000-7000-8000-00000000001024',
    revision: 1,
    origin: {
      type: 'RUN',
      id: '0199e5b2-0000-7000-8000-000000000001'
    },
    verdict: {
      code: 'UNAVAILABLE',
      label: '불가'
    },
    outOfScope: false,
    blockedAtGate: 'G1',
    account: null,
    finalAmount: null,
    isInference: false,
    unmatchedReason: null,
    attributes: {

    },
    ruleCardId: 'R-118',
    ruleCardVersion: 3,
    appliedRuleIds: ['R-118'],
    rulesCommitSha: '139f8189',
    userContextVersion: 4,
    explanation: '문진에서 사업용 차량을 보유하지 않는다고 응답했습니다. 사업용 차량이 없으므로 유류비는 가사 관련 경비로 봅니다.',
    computedAt: '2026-09-12T14:05:00+09:00',
    citations: [
      {
        statuteVersionId: 1435,
        statuteId: '소득세법-33-1-5'
      }
    ]
  }
];

export const QUESTION_GROUPS: QuestionGroup[] = [
  {
    groupKey: 'merchant:카페 · 편의점',
    factType: '용도',
    questionIds: [
      '0199a1b2-0000-7000-8000-00000000001005',
      '0199a1b2-0000-7000-8000-00000000001017'
    ],
    count: 24,
    totalAmount: 287_400,
    questionText: '이 가맹점에서 쓴 비용은 주로 어떤 목적이었나요?',
    options: [
      '업무 목적',
      '개인 목적',
      '섞여 있음'
    ]
  },
  {
    groupKey: 'merchant:택시 · 대중교통',
    factType: '용도',
    questionIds: [
      '0199a1b2-0000-7000-8000-00000000001006'
    ],
    count: 18,
    totalAmount: 214_800,
    questionText: '이 이동은 업무 목적이었나요?',
    options: [
      '업무 이동',
      '개인 이동',
      '섞여 있음'
    ]
  },
  {
    groupKey: 'merchant:통신비 · 자택 관리비',
    factType: '용도',
    questionIds: [
      '0199a1b2-0000-7000-8000-00000000001007',
      '0199a1b2-0000-7000-8000-00000000001008'
    ],
    count: 14,
    totalAmount: 1_642_000,
    questionText: '업무용으로 쓰는 비율은 몇 %인가요?',
    options: [
      '20%',
      '50%',
      '80%'
    ]
  },
  {
    groupKey: 'merchant:연간 구독 결제',
    factType: '용도',
    questionIds: [
      '0199a1b2-0000-7000-8000-00000000001004'
    ],
    count: 9,
    totalAmount: 1_884_000,
    questionText: '이 결제가 커버하는 서비스 기간은 어떻게 되나요?',
    options: [
      '올해 안에 끝남',
      '다음 해까지 걸침',
      '모르겠음'
    ]
  },
  {
    groupKey: 'merchant:분류하지 못한 가맹점',
    factType: '용도',
    questionIds: [
      '0199a1b2-0000-7000-8000-00000000001023'
    ],
    count: 6,
    totalAmount: 284_200,
    questionText: '이 가맹점은 어떤 업종인가요?',
    options: [
      '소프트웨어 · 개발 도구',
      '광고 · 마케팅',
      '그 외'
    ]
  }
];

/** 목업 전용: 질문 그룹 → 해당 거래. 서버에서는 questionId로 이어진다. */
export const QUESTION_TRANSACTIONS: Record<string, string[]> = {
  'merchant:카페 · 편의점': [
    '0199c8f2-0000-7000-8000-00000000001005',
    '0199c8f2-0000-7000-8000-00000000001017'
  ],
  'merchant:택시 · 대중교통': [
    '0199c8f2-0000-7000-8000-00000000001006'
  ],
  'merchant:통신비 · 자택 관리비': [
    '0199c8f2-0000-7000-8000-00000000001007',
    '0199c8f2-0000-7000-8000-00000000001008'
  ],
  'merchant:연간 구독 결제': [
    '0199c8f2-0000-7000-8000-00000000001004'
  ],
  'merchant:분류하지 못한 가맹점': [
    '0199c8f2-0000-7000-8000-00000000001023'
  ]
};

/** 목업 전용: 답변 라벨 → 재판정 결과. 서버 룰엔진이 하는 일을 흉내 낸다. */
export const QUESTION_ANSWER_VERDICT: Record<string, Record<string, Verdict>> = {
  'merchant:카페 · 편의점': {
    '업무 목적': 'AVAILABLE',
    '개인 목적': 'UNAVAILABLE',
    '섞여 있음': 'NEEDS_REVIEW'
  },
  'merchant:택시 · 대중교통': {
    '업무 이동': 'AVAILABLE',
    '개인 이동': 'UNAVAILABLE',
    '섞여 있음': 'NEEDS_REVIEW'
  },
  'merchant:통신비 · 자택 관리비': {
    '20%': 'AVAILABLE',
    '50%': 'AVAILABLE',
    '80%': 'AVAILABLE'
  },
  'merchant:연간 구독 결제': {
    '올해 안에 끝남': 'AVAILABLE',
    '다음 해까지 걸침': 'AVAILABLE',
    '모르겠음': 'NEEDS_REVIEW'
  },
  'merchant:분류하지 못한 가맹점': {
    '소프트웨어 · 개발 도구': 'AVAILABLE',
    '광고 · 마케팅': 'AVAILABLE',
    '그 외': 'AVAILABLE'
  }
};


/** 미분류로 남아 분류 확인이 필요한 거래. GET /classification-reviews */
export const CLASSIFICATION_REVIEWS: ClassificationReview[] = [
{
  id: '0199c100-0000-7000-8000-000000000001',
  batchId: '0199c8f2-0000-7000-8000-000000000001',
  transactionId: '0199c8f2-0000-7000-8000-0000000001022',
  merchantRaw: 'XYZ PAYMENTS',
  merchantNorm: 'XYZ PAYMENTS',
  status: { code: 'PENDING', label: '대기' },
  suggestedCategories: ['해외SaaS', '온라인쇼핑', '기타'],
  createdAt: '2026-09-12T13:58:10+09:00',
  resolvedAt: null
},
{
  id: '0199c100-0000-7000-8000-000000000002',
  batchId: '0199c8f2-0000-7000-8000-000000000001',
  transactionId: '0199c8f2-0000-7000-8000-0000000001023',
  merchantRaw: '(주)케이지이니시스',
  merchantNorm: 'KG이니시스',
  status: { code: 'PENDING', label: '대기' },
  suggestedCategories: ['PG_미상', '온라인쇼핑', '기타'],
  createdAt: '2026-09-12T13:58:11+09:00',
  resolvedAt: null
},
{
  id: '0199c100-0000-7000-8000-000000000003',
  batchId: '0199c8f2-0000-7000-8000-000000000001',
  transactionId: '0199c8f2-0000-7000-8000-0000000001024',
  merchantRaw: 'PADDLE.NET* CURSOR',
  merchantNorm: 'Paddle',
  status: { code: 'PENDING', label: '대기' },
  suggestedCategories: ['해외SaaS', '국내SW', '기타'],
  createdAt: '2026-09-12T13:58:12+09:00',
  resolvedAt: null
}];
