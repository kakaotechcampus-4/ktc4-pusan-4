import type { Judgment, QuestionGroup } from '../types/domain';

/** 배치 전체 집계. 화면에 보이는 목록은 이 중 첫 페이지다. */
export const BATCH_SUMMARY = {
  total: 292,
  possible: 168,
  needsReview: 71,
  impossible: 53,
  possibleAmount: 21_483_000,
  needsReviewAmount: 4_312_400,
  impossibleAmount: 6_940_600,
  rulesCommitSha: '139f8189',
  taxYear: 2026,
  contextVersion: 4
};

export const JUDGMENTS: Judgment[] = [
{
  id: 'J-1001',
  transaction: {
    id: 'T-1001',
    transactedAt: '2026-01-03',
    merchantRaw: 'AWS APN1',
    merchantNorm: 'Amazon Web Services',
    merchantCategory: '클라우드 서비스',
    amount: 137_000,
    installmentMonths: 0
  },
  verdict: 'POSSIBLE',
  blockedAtGate: null,
  reasonCode: null,
  isInference: false,
  finalAmount: 137_000,
  ratio: null,
  ruleCardId: 'R-027',
  reason:
  '소프트웨어 개발업(62010)에서 서비스 운영을 위한 클라우드 사용료는 사업 수행에 직접 대응하는 비용으로, 동일 업종에서 통상적으로 지출됩니다.',
  citations: ['소득세법-27-1', '소득세법시행령-55-1-13'],
  documents: ['카드 승인내역', '월별 사용요금 인보이스(AWS 콘솔)'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인 · 형식 검증 통과' },
  { gate: 'G1', result: '§33 불산입 항목 해당 없음' },
  { gate: 'G2', result: '통상성 인정 (업종 프로파일 62010)' },
  { gate: 'G3', result: '자산 아님 · 안분 대상 아님' },
  { gate: 'G4', result: '전액 137,000원 산입' },
  { gate: 'G5', result: '한도 버킷 해당 없음' },
  { gate: 'G6', result: '근거 조문 2건 부착' }],

  groupKey: null
},
{
  id: 'J-1002',
  transaction: {
    id: 'T-1002',
    transactedAt: '2026-01-05',
    merchantRaw: 'GITHUB INC',
    merchantNorm: 'GitHub',
    merchantCategory: '소프트웨어',
    amount: 27_500,
    installmentMonths: 0
  },
  verdict: 'POSSIBLE',
  blockedAtGate: null,
  reasonCode: null,
  isInference: false,
  finalAmount: 27_500,
  ratio: null,
  ruleCardId: 'R-031',
  reason:
  '개발 업무에 사용하는 코드 저장소 구독료로, 사업 수행에 직접 사용되는 용역의 대가에 해당합니다.',
  citations: ['소득세법-27-1', '소득세법시행령-55-1-13'],
  documents: ['카드 승인내역', '구독 영수증'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '불산입 항목 해당 없음' },
  { gate: 'G2', result: '통상성 인정' },
  { gate: 'G3', result: '속성 없음' },
  { gate: 'G4', result: '전액 산입' },
  { gate: 'G5', result: '한도 없음' },
  { gate: 'G6', result: '근거 2건' }],

  groupKey: null
},
{
  id: 'J-1003',
  transaction: {
    id: 'T-1003',
    transactedAt: '2026-01-08',
    merchantRaw: '(주)한국애플 온라인',
    merchantNorm: 'Apple 대한민국',
    merchantCategory: '전자기기',
    amount: 3_490_000,
    installmentMonths: 12
  },
  verdict: 'POSSIBLE',
  blockedAtGate: null,
  reasonCode: null,
  isInference: false,
  finalAmount: 640_166,
  ratio: null,
  ruleCardId: 'R-044',
  reason:
  '취득가액 100만원을 초과하는 사업용 자산으로 감가상각 대상입니다. 승인 기준 원금 전액을 취득가액으로 보고, 2026년 귀속분은 내용연수 5년 정액법 · 사업연도 중 11개월분만 산입합니다.',
  citations: ['소득세법시행령-55-1-7', '소득세법시행령-62-1'],
  documents: ['카드 승인내역', '세금계산서 또는 구매 영수증', '자산 등록 내역'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 · 12개월 할부 (원금 1건)' },
  { gate: 'G1', result: '불산입 항목 해당 없음' },
  { gate: 'G2', result: '통상성 인정' },
  { gate: 'G3', result: '자산 = true · 내용연수 5년 · 정액법' },
  { gate: 'G4', result: '상각범위액 640,166원 (11/12개월)' },
  { gate: 'G5', result: '한도 버킷 해당 없음' },
  { gate: 'G6', result: '근거 2건 부착' }],

  groupKey: null
},
{
  id: 'J-1004',
  transaction: {
    id: 'T-1004',
    transactedAt: '2026-01-10',
    merchantRaw: 'ADOBE SYSTEMS SOFTWARE',
    merchantNorm: 'Adobe',
    merchantCategory: '소프트웨어',
    amount: 660_000,
    installmentMonths: 0
  },
  verdict: 'NEEDS_REVIEW',
  blockedAtGate: 'G3_기간속성',
  reasonCode: 'PERIOD_UNKNOWN',
  isInference: false,
  finalAmount: 0,
  ratio: null,
  ruleCardId: 'R-052',
  reason:
  '연간 일시납 구독으로 보이나 서비스 제공 기간이 확인되지 않습니다. 기간이 다음 과세연도에 걸치면 선급비용으로 안분해야 하므로 전액 산입할 수 없습니다.',
  citations: ['소득세법-27-1'],
  documents: ['구독 시작·종료일이 표시된 인보이스'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '불산입 항목 해당 없음' },
  { gate: 'G2', result: '통상성 인정' },
  { gate: 'G3', result: '기간 속성 미확보 → 확인 필요로 강등' }],

  groupKey: 'PERIOD_SUBSCRIPTION'
},
{
  id: 'J-1005',
  transaction: {
    id: 'T-1005',
    transactedAt: '2026-01-12',
    merchantRaw: '스타벅스코리아 서면점',
    merchantNorm: '스타벅스',
    merchantCategory: '카페',
    amount: 12_800,
    installmentMonths: 0
  },
  verdict: 'NEEDS_REVIEW',
  blockedAtGate: 'G2_통상성',
  reasonCode: 'PURPOSE_UNKNOWN',
  isInference: false,
  finalAmount: 0,
  ratio: null,
  ruleCardId: 'R-013',
  reason:
  '1인 사업자의 단독 카페 이용은 세무 실무에서도 판단이 갈리는 항목입니다. 지출 목적이 확인되지 않아 단정하지 않고 확인 필요로 고정합니다.',
  citations: ['소득세법-27-1'],
  documents: ['업무 수행 사실을 보이는 자료(작업 기록, 미팅 상대)'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '불산입 항목 해당 없음' },
  { gate: 'G2', result: '목적 불명 → 확인 필요로 강등' }],

  groupKey: 'PURPOSE_CAFE'
},
{
  id: 'J-1006',
  transaction: {
    id: 'T-1006',
    transactedAt: '2026-01-14',
    merchantRaw: '카카오모빌리티',
    merchantNorm: '카카오 T',
    merchantCategory: '교통',
    amount: 9_400,
    installmentMonths: 0
  },
  verdict: 'NEEDS_REVIEW',
  blockedAtGate: 'G2_통상성',
  reasonCode: 'PURPOSE_UNKNOWN',
  isInference: false,
  finalAmount: 0,
  ratio: null,
  ruleCardId: 'R-018',
  reason:
  '이동 목적이 업무인지 사적인지 거래 내역만으로는 구분되지 않습니다. 목적 확인 후 재판정합니다.',
  citations: ['소득세법-27-1'],
  documents: ['이동 목적(미팅 상대·장소) 기록'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '불산입 항목 해당 없음' },
  { gate: 'G2', result: '목적 불명 → 확인 필요' }],

  groupKey: 'PURPOSE_TRANSPORT'
},
{
  id: 'J-1007',
  transaction: {
    id: 'T-1007',
    transactedAt: '2026-01-15',
    merchantRaw: 'SKT 이용요금',
    merchantNorm: 'SK텔레콤',
    merchantCategory: '통신비',
    amount: 78_000,
    installmentMonths: 0
  },
  verdict: 'NEEDS_REVIEW',
  blockedAtGate: 'G3_안분율',
  reasonCode: 'RATIO_MISSING',
  isInference: false,
  finalAmount: 0,
  ratio: null,
  ruleCardId: 'R-021',
  reason:
  '사업과 가사에 공통으로 관련되는 경비입니다. 사업 사용 비율이 객관적으로 구분되는 범위에서만 산입할 수 있으므로 안분율이 필요합니다.',
  citations: ['소득세법-33-1-5'],
  documents: ['업무용 사용 비율 산정 근거'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '§33 제1항 제5호 단서 적용 검토' },
  { gate: 'G2', result: '통상성 인정' },
  { gate: 'G3', result: '안분율 미확보 → 확인 필요' }],

  groupKey: 'RATIO_SHARED'
},
{
  id: 'J-1008',
  transaction: {
    id: 'T-1008',
    transactedAt: '2026-01-16',
    merchantRaw: '(주)이지스자산관리 관리비',
    merchantNorm: '자택 관리비',
    merchantCategory: '주거·시설',
    amount: 184_000,
    installmentMonths: 0
  },
  verdict: 'NEEDS_REVIEW',
  blockedAtGate: 'G3_안분율',
  reasonCode: 'RATIO_MISSING',
  isInference: false,
  finalAmount: 0,
  ratio: null,
  ruleCardId: 'R-022',
  reason:
  '자택을 작업공간으로 사용한다고 문진에서 응답했습니다(면적 비율 20%). 다만 이 지출이 작업공간에 대응하는 부분인지 확인이 필요합니다.',
  citations: ['소득세법-33-1-5'],
  documents: ['면적 비율 산정 자료(도면·계약서)', '관리비 명세서'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '가사 관련 경비 검토' },
  { gate: 'G2', result: '통상성 조건부 인정' },
  { gate: 'G3', result: '안분 대상 확인 필요' }],

  groupKey: 'RATIO_SHARED'
},
{
  id: 'J-1009',
  transaction: {
    id: 'T-1009',
    transactedAt: '2026-01-17',
    merchantRaw: '이마트 하단점',
    merchantNorm: '이마트',
    merchantCategory: '대형마트',
    amount: 96_300,
    installmentMonths: 0
  },
  verdict: 'IMPOSSIBLE',
  blockedAtGate: 'G1_불산입',
  reasonCode: null,
  isInference: false,
  finalAmount: 0,
  ratio: null,
  ruleCardId: 'R-006',
  reason:
  '직원이 없는 1인 사업자의 대형마트 식료품 구매는 가사에 관련되는 경비로 봅니다. 사업에 직접 관련되는 부분이 명백히 구분되지 않습니다.',
  citations: ['소득세법-33-1-5', '대법원-2019두12345'],
  documents: [],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '§33 제1항 제5호 가사 관련 경비 → 불가' }],

  groupKey: null
},
{
  id: 'J-1010',
  transaction: {
    id: 'T-1010',
    transactedAt: '2026-01-18',
    merchantRaw: '부산은퇴자골프클럽',
    merchantNorm: '골프장',
    merchantCategory: '여가·스포츠',
    amount: 240_000,
    installmentMonths: 0
  },
  verdict: 'IMPOSSIBLE',
  blockedAtGate: 'G1_불산입',
  reasonCode: null,
  isInference: false,
  finalAmount: 0,
  ratio: null,
  ruleCardId: 'R-009',
  reason:
  '업무와 관련 없는 지출로 열거된 항목에 해당합니다. 거래처 접대 사실이 확인되는 경우에도 접대비 한도 규정이 별도로 적용됩니다.',
  citations: ['소득세법-33-1-13', '소득세법-33-1-14'],
  documents: [],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '업무 무관 지출 → 불가' }],

  groupKey: null
},
{
  id: 'J-1011',
  transaction: {
    id: 'T-1011',
    transactedAt: '2026-01-19',
    merchantRaw: '서울대학교병원',
    merchantNorm: '병원',
    merchantCategory: '의료',
    amount: 62_000,
    installmentMonths: 0
  },
  verdict: 'IMPOSSIBLE',
  blockedAtGate: 'G1_불산입',
  reasonCode: null,
  isInference: false,
  finalAmount: 0,
  ratio: null,
  ruleCardId: 'R-004',
  reason:
  '본인 의료비는 가사 관련 경비로 필요경비에 산입하지 않습니다. 종합소득세 신고 시 의료비 세액공제 항목으로는 별도 검토할 수 있습니다.',
  citations: ['소득세법-33-1-5'],
  documents: [],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '가사 관련 경비 → 불가' }],

  groupKey: null
},
{
  id: 'J-1012',
  transaction: {
    id: 'T-1012',
    transactedAt: '2026-01-20',
    merchantRaw: '국세청 국세납부',
    merchantNorm: '국세 납부',
    merchantCategory: '조세',
    amount: 1_240_000,
    installmentMonths: 0
  },
  verdict: 'IMPOSSIBLE',
  blockedAtGate: 'G1_불산입',
  reasonCode: null,
  isInference: false,
  finalAmount: 0,
  ratio: null,
  ruleCardId: 'R-001',
  reason:
  '소득세와 개인지방소득세는 필요경비 불산입 항목으로 법에 직접 열거되어 있습니다.',
  citations: ['소득세법-33-1-1'],
  documents: [],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '§33 제1항 제1호 → 불가' }],

  groupKey: null
},
{
  id: 'J-1013',
  transaction: {
    id: 'T-1013',
    transactedAt: '2026-01-21',
    merchantRaw: 'NOTION LABS INC',
    merchantNorm: 'Notion',
    merchantCategory: '소프트웨어',
    amount: 14_300,
    installmentMonths: 0
  },
  verdict: 'POSSIBLE',
  blockedAtGate: null,
  reasonCode: null,
  isInference: false,
  finalAmount: 14_300,
  ratio: null,
  ruleCardId: 'R-031',
  reason:
  '업무 문서·일정 관리 도구 구독료로 사업에 직접 사용되는 용역의 대가에 해당합니다.',
  citations: ['소득세법-27-1', '소득세법시행령-55-1-13'],
  documents: ['카드 승인내역', '구독 영수증'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '해당 없음' },
  { gate: 'G2', result: '통상성 인정' },
  { gate: 'G3', result: '속성 없음' },
  { gate: 'G4', result: '전액 산입' },
  { gate: 'G5', result: '한도 없음' },
  { gate: 'G6', result: '근거 2건' }],

  groupKey: null
},
{
  id: 'J-1014',
  transaction: {
    id: 'T-1014',
    transactedAt: '2026-01-22',
    merchantRaw: '교보문고 광화문',
    merchantNorm: '교보문고',
    merchantCategory: '도서',
    amount: 38_000,
    installmentMonths: 0
  },
  verdict: 'POSSIBLE',
  blockedAtGate: null,
  reasonCode: null,
  isInference: false,
  finalAmount: 38_000,
  ratio: null,
  ruleCardId: 'R-036',
  reason:
  '업종과 직접 관련된 기술 서적 구입비로, 동일 업종에서 통상적으로 지출되는 비용입니다.',
  citations: ['소득세법-27-1', '기본통칙-27-1'],
  documents: ['카드 승인내역', '도서 구매 영수증(도서명 확인 가능)'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '해당 없음' },
  { gate: 'G2', result: '통상성 인정 (업종 프로파일)' },
  { gate: 'G3', result: '자산 아님 (100만원 이하)' },
  { gate: 'G4', result: '전액 산입' },
  { gate: 'G5', result: '한도 없음' },
  { gate: 'G6', result: '근거 1건 + 참고 1건' }],

  groupKey: null
},
{
  id: 'J-1015',
  transaction: {
    id: 'T-1015',
    transactedAt: '2026-01-23',
    merchantRaw: '위워크 서면 데스크',
    merchantNorm: 'WeWork',
    merchantCategory: '공간 임차',
    amount: 330_000,
    installmentMonths: 0
  },
  verdict: 'POSSIBLE',
  blockedAtGate: null,
  reasonCode: null,
  isInference: false,
  finalAmount: 330_000,
  ratio: null,
  ruleCardId: 'R-040',
  reason:
  '사업 수행 장소의 임차료로, 사업용 자산의 임차료 항목에 직접 해당합니다.',
  citations: ['소득세법시행령-55-1-13', '소득세법-27-1'],
  documents: ['카드 승인내역', '임차 계약서 또는 이용 명세서'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '해당 없음' },
  { gate: 'G2', result: '통상성 인정' },
  { gate: 'G3', result: '안분 불필요 (전용 공간)' },
  { gate: 'G4', result: '전액 산입' },
  { gate: 'G5', result: '한도 없음' },
  { gate: 'G6', result: '근거 2건' }],

  groupKey: null
},
{
  id: 'J-1016',
  transaction: {
    id: 'T-1016',
    transactedAt: '2026-01-24',
    merchantRaw: '한우마을 본점',
    merchantNorm: '한우마을',
    merchantCategory: '접대·식음료',
    amount: 412_000,
    installmentMonths: 0
  },
  verdict: 'POSSIBLE',
  blockedAtGate: null,
  reasonCode: null,
  isInference: false,
  finalAmount: 412_000,
  ratio: null,
  ruleCardId: 'R-057',
  reason:
  '거래처 접대 목적이 확인된 지출로 접대비 버킷에 태그했습니다. 연말 한도 확정 시 초과분은 불산입으로 조정됩니다.',
  citations: ['소득세법-33-1-14', '소득세법-27-1'],
  documents: ['카드 승인내역', '접대 상대·목적 기록'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '해당 없음' },
  { gate: 'G2', result: '통상성 인정' },
  { gate: 'G3', result: '한도버킷 = 접대비' },
  { gate: 'G4', result: '412,000원 태그' },
  { gate: 'G5', result: '잠정 인정 · 연말 한도 재계산 대상' },
  { gate: 'G6', result: '근거 2건' }],

  groupKey: null
},
{
  id: 'J-1017',
  transaction: {
    id: 'T-1017',
    transactedAt: '2026-01-25',
    merchantRaw: 'GS25 대연동',
    merchantNorm: 'GS25',
    merchantCategory: '편의점',
    amount: 8_600,
    installmentMonths: 0
  },
  verdict: 'NEEDS_REVIEW',
  blockedAtGate: 'G2_통상성',
  reasonCode: 'PURPOSE_UNKNOWN',
  isInference: false,
  finalAmount: 0,
  ratio: null,
  ruleCardId: 'R-013',
  reason:
  '편의점 지출은 품목에 따라 업무 관련성이 달라집니다. 목적이 확인되지 않아 확인 필요로 둡니다.',
  citations: ['소득세법-27-1'],
  documents: ['구매 품목이 확인되는 영수증'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '해당 없음' },
  { gate: 'G2', result: '목적 불명 → 확인 필요' }],

  groupKey: 'PURPOSE_CAFE'
},
{
  id: 'J-1018',
  transaction: {
    id: 'T-1018',
    transactedAt: '2026-01-26',
    merchantRaw: 'KTX 승차권 부산-서울',
    merchantNorm: '한국철도공사',
    merchantCategory: '교통',
    amount: 119_600,
    installmentMonths: 0
  },
  verdict: 'POSSIBLE',
  blockedAtGate: null,
  reasonCode: null,
  isInference: false,
  finalAmount: 119_600,
  ratio: null,
  ruleCardId: 'R-019',
  reason:
  '거래처 방문 사실이 이전 응답으로 저장되어 있어(사실 저장소) 업무 관련 여비로 판정했습니다.',
  citations: ['소득세법-27-1', '소득세법시행령-55-1-13'],
  documents: ['카드 승인내역', '방문 일정·상대 기록'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '해당 없음' },
  { gate: 'G2', result: '사실 저장소 적용: 용도 = 업무' },
  { gate: 'G3', result: '속성 없음' },
  { gate: 'G4', result: '전액 산입' },
  { gate: 'G5', result: '한도 없음' },
  { gate: 'G6', result: '근거 2건' }],

  groupKey: null
},
{
  id: 'J-1019',
  transaction: {
    id: 'T-1019',
    transactedAt: '2026-01-27',
    merchantRaw: '롯데백화점 상품권',
    merchantNorm: '백화점 상품권',
    merchantCategory: '상품권',
    amount: 500_000,
    installmentMonths: 0
  },
  verdict: 'IMPOSSIBLE',
  blockedAtGate: 'G1_불산입',
  reasonCode: null,
  isInference: false,
  finalAmount: 0,
  ratio: null,
  ruleCardId: 'R-011',
  reason:
  '상품권 구입 자체는 사용처가 확인되지 않아 업무 관련 지출로 볼 수 없습니다. 실제 사용 내역으로 별도 증빙이 필요합니다.',
  citations: ['소득세법-33-1-13'],
  documents: [],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '업무 무관 지출 → 불가' }],

  groupKey: null
},
{
  id: 'J-1020',
  transaction: {
    id: 'T-1020',
    transactedAt: '2026-01-28',
    merchantRaw: 'NETFLIX.COM',
    merchantNorm: 'Netflix',
    merchantCategory: '구독·미디어',
    amount: 17_000,
    installmentMonths: 0
  },
  verdict: 'IMPOSSIBLE',
  blockedAtGate: 'G2_통상성',
  reasonCode: null,
  isInference: false,
  finalAmount: 0,
  ratio: null,
  ruleCardId: 'R-014',
  reason:
  '소프트웨어 개발업에서 영상 스트리밍 구독은 동일 업종의 통상적 지출로 인정되지 않습니다.',
  citations: ['소득세법-27-1', '기본통칙-27-1'],
  documents: [],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '해당 없음' },
  { gate: 'G2', result: '통상성 부정 → 불가' }],

  groupKey: null
},
{
  id: 'J-1021',
  transaction: {
    id: 'T-1021',
    transactedAt: '2026-01-29',
    merchantRaw: '오피스디포 데스크체어',
    merchantNorm: '오피스디포',
    merchantCategory: '사무용품',
    amount: 420_000,
    installmentMonths: 3
  },
  verdict: 'POSSIBLE',
  blockedAtGate: null,
  reasonCode: null,
  isInference: false,
  finalAmount: 420_000,
  ratio: null,
  ruleCardId: 'R-046',
  reason:
  '취득가액이 거래단위별 100만원 이하인 사무용 자산으로, 사용한 과세기간의 필요경비로 계상할 수 있습니다. 3개월 할부이나 승인 기준 원금 전액으로 봅니다.',
  citations: ['소득세법시행령-62-1', '소득세법-27-1'],
  documents: ['카드 승인내역', '구매 영수증'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 · 3개월 할부' },
  { gate: 'G1', result: '해당 없음' },
  { gate: 'G2', result: '통상성 인정' },
  { gate: 'G3', result: '자산 = false (100만원 이하 즉시 비용)' },
  { gate: 'G4', result: '전액 420,000원 산입' },
  { gate: 'G5', result: '한도 없음' },
  { gate: 'G6', result: '근거 2건' }],

  groupKey: null
},
{
  id: 'J-1022',
  transaction: {
    id: 'T-1022',
    transactedAt: '2026-01-30',
    merchantRaw: '유니세프한국위원회',
    merchantNorm: '유니세프',
    merchantCategory: '기부금',
    amount: 300_000,
    installmentMonths: 0
  },
  verdict: 'NEEDS_REVIEW',
  blockedAtGate: 'G5_한도',
  reasonCode: 'EXCLUSIVE_USE_UNKNOWN',
  isInference: false,
  finalAmount: 0,
  ratio: null,
  ruleCardId: 'R-061',
  reason:
  '기부금 한도는 연간 소득금액이 확정된 후 계산됩니다. 현재는 잠정 상태로, 한도 초과분은 이후 과세기간으로 이월됩니다.',
  citations: ['소득세법-34-1'],
  documents: ['기부금영수증'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '해당 없음' },
  { gate: 'G2', result: '통상성 검토 통과' },
  { gate: 'G3', result: '한도버킷 = 기부금' },
  { gate: 'G4', result: '300,000원 태그' },
  { gate: 'G5', result: '소득금액 미확정 → 확인 필요' }],

  groupKey: 'LIMIT_DONATION'
},
{
  id: 'J-1023',
  transaction: {
    id: 'T-1023',
    transactedAt: '2026-01-31',
    merchantRaw: 'ELEVENLABS IO',
    merchantNorm: '미확인 가맹점',
    merchantCategory: '미분류',
    amount: 33_000,
    installmentMonths: 0
  },
  verdict: 'NEEDS_REVIEW',
  blockedAtGate: 'G2_통상성',
  reasonCode: 'MERCHANT_UNRESOLVED',
  isInference: true,
  finalAmount: 0,
  ratio: null,
  ruleCardId: '—',
  reason:
  '가맹점 정규화에 실패해 카테고리를 확정하지 못했습니다. 분류 신뢰도가 임계값에 미달해 미분류로 유지했고, 매칭되는 규칙 카드가 없어 확인 필요로 남습니다.',
  citations: [],
  documents: ['해당 서비스 이용 내역'],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '해당 없음' },
  { gate: 'G2', result: '가맹점 미해결 · confidence 0.41 → 확인 필요' }],

  groupKey: 'MERCHANT_UNRESOLVED'
},
{
  id: 'J-1024',
  transaction: {
    id: 'T-1024',
    transactedAt: '2026-01-31',
    merchantRaw: 'SK에너지 대연주유소',
    merchantNorm: 'SK에너지',
    merchantCategory: '주유',
    amount: 70_000,
    installmentMonths: 0
  },
  verdict: 'IMPOSSIBLE',
  blockedAtGate: 'G1_불산입',
  reasonCode: null,
  isInference: false,
  finalAmount: 0,
  ratio: null,
  ruleCardId: 'R-008',
  reason:
  '문진에서 사업용 차량을 보유하지 않는다고 응답했습니다. 사업용 차량이 없으므로 유류비는 가사 관련 경비로 봅니다.',
  citations: ['소득세법-33-1-5'],
  documents: [],
  gateTrace: [
  { gate: 'G0', result: '승인내역 확인' },
  { gate: 'G1', result: '문진: 차량 보유 = false → 불가' }],

  groupKey: null
}];


export const QUESTION_GROUPS: QuestionGroup[] = [
{
  groupKey: 'PURPOSE_CAFE',
  reasonCode: 'PURPOSE_UNKNOWN',
  reasonLabel: '용도 불명',
  merchantLabel: '카페 · 편의점',
  count: 24,
  amount: 287_400,
  question: '이 가맹점에서 쓴 비용은 주로 어떤 목적이었나요?',
  helper:
  '한 번 답하면 같은 가맹점의 남은 건에 함께 적용되고, 다음 판정에서는 묻지 않습니다.',
  answerType: 'CHOICE',
  options: [
  { value: 'BUSINESS', label: '업무 목적', hint: '작업·미팅 등 업무 수행' },
  { value: 'PERSONAL', label: '개인 목적' },
  { value: 'MIXED', label: '섞여 있음', hint: '건별로 다시 확인합니다' }],

  sampleMerchants: ['스타벅스', '이디야커피', 'GS25', '투썸플레이스']
},
{
  groupKey: 'PURPOSE_TRANSPORT',
  reasonCode: 'PURPOSE_UNKNOWN',
  reasonLabel: '용도 불명',
  merchantLabel: '택시 · 대중교통',
  count: 18,
  amount: 214_800,
  question: '이 이동은 업무 목적이었나요?',
  helper: '이동 목적이 업무로 확인되면 여비로 산입할 수 있습니다.',
  answerType: 'CHOICE',
  options: [
  { value: 'BUSINESS', label: '업무 이동' },
  { value: 'PERSONAL', label: '개인 이동' },
  { value: 'MIXED', label: '섞여 있음' }],

  sampleMerchants: ['카카오 T', '우티', '서울도시철도']
},
{
  groupKey: 'RATIO_SHARED',
  reasonCode: 'RATIO_MISSING',
  reasonLabel: '안분율 없음',
  merchantLabel: '통신비 · 자택 관리비',
  count: 14,
  amount: 1_642_000,
  question: '업무용으로 쓰는 비율은 몇 %인가요?',
  helper:
  '사업과 가사에 공통되는 경비는 구분되는 부분만 산입합니다. 문진에서 응답한 자택 작업공간 비율(20%)을 기본값으로 제안합니다.',
  answerType: 'RATIO',
  options: [
  { value: '20', label: '20%', hint: '문진 응답값' },
  { value: '50', label: '50%' },
  { value: '80', label: '80%' }],

  sampleMerchants: ['SK텔레콤', '자택 관리비', 'KT 인터넷']
},
{
  groupKey: 'PERIOD_SUBSCRIPTION',
  reasonCode: 'PERIOD_UNKNOWN',
  reasonLabel: '기간 불명',
  merchantLabel: '연간 구독 결제',
  count: 9,
  amount: 1_884_000,
  question: '이 결제가 커버하는 서비스 기간은 어떻게 되나요?',
  helper: '기간이 다음 연도에 걸치면 선급비용으로 나누어 배분합니다.',
  answerType: 'CHOICE',
  options: [
  { value: 'WITHIN_YEAR', label: '올해 안에 끝남' },
  { value: 'CROSS_YEAR', label: '다음 해까지 걸침' },
  { value: 'UNKNOWN', label: '모르겠음', hint: '핸드오프 목록에 남겨둡니다' }],

  sampleMerchants: ['Adobe', 'JetBrains', 'Figma']
},
{
  groupKey: 'MERCHANT_UNRESOLVED',
  reasonCode: 'MERCHANT_UNRESOLVED',
  reasonLabel: '가맹점 미해결',
  merchantLabel: '분류하지 못한 가맹점',
  count: 6,
  amount: 284_200,
  question: '이 가맹점은 어떤 업종인가요?',
  helper:
  '공개정보 검색으로도 업태를 확정하지 못했습니다. 응답은 사용자 본인에게만 적용됩니다.',
  answerType: 'CHOICE',
  options: [
  { value: 'SOFTWARE', label: '소프트웨어 · 개발 도구' },
  { value: 'MARKETING', label: '광고 · 마케팅' },
  { value: 'OTHER', label: '그 외' }],

  sampleMerchants: ['ELEVENLABS IO', 'RESEND', 'LINEAR.APP']
}];