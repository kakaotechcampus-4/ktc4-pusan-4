import {
  BusinessContextEntity,
  ClassificationReviewEntity,
  JudgmentEntity,
  JudgmentRunEntity,
  QuestionEntity,
  StatuteEntity,
  TransactionEntity,
  UploadBatchEntity,
  UserEntity,
} from '../store/entities';

/**
 * frontend/src/mock/judgments.ts, frontend/src/mock/statutes.ts 의 실제 한국어 콘텐츠를
 * 현재 docs/api.md 계약 모양으로 재구성한 시드 데이터.
 *
 * frontend 목업과 다르게 구현한 부분 (docs/api-mock-implementation.md에도 기록):
 * - `state`(PROVISIONAL/FINALIZED) 필드는 현재 스펙에서 제거되어 옮기지 않았다.
 * - 거래의 flat `status`를 sourceStatus/userInclusion/classificationStatus로 분리했다.
 * - merchantCategory 자유 텍스트를 docs/categories.md의 canonical 32종(+미분류) enum으로 매핑했다.
 * - tx1023(ELEVENLABS IO, 미분류)은 §0.5 "미분류 거래는 Rule Engine에 전달하지 않는다"에 따라
 *   Judgment를 생성하지 않고 ClassificationReview만 PENDING으로 둔다 (frontend 목업은 이 룰이
 *   정리되기 전이라 isInference:true인 fallback Judgment를 갖고 있었다 — 옮기지 않음).
 * - QUESTION_GROUPS 중 "분류하지 못한 가맹점" 그룹은 ClassificationReview와 중복되는 항목이라
 *   Question(룰엔진 확인 질문)에서는 제외했다 (§0.5 ClassificationReview와 Question 분리).
 */

export const USER_ID = '0199u000-0000-7000-8000-000000000001';
export const CONTEXT_ID = '0199d3a1-0000-7000-8000-000000000001';
export const BATCH_ID = '0199c8f2-0000-7000-8000-000000000001';
export const RUN_ID = '0199e5b2-0000-7000-8000-000000000001';
const REVIEW_ID = '0199c1a1-0000-7000-8000-000000000001';

export const SEED_USER: UserEntity = {
  id: USER_ID,
  email: 'zerom50@gmail.com',
  createdAt: '2026-09-01T10:00:00+09:00',
};

export const SEED_CONTEXT: BusinessContextEntity = {
  id: CONTEXT_ID,
  userId: USER_ID,
  version: 1,
  industryCode: '62010',
  prevYearRevenue: 82_000_000,
  businessOpenDate: '2024-03-15',
  bookkeepingDuty: '간편장부',
  hasEmployee: false,
  homeOfficeRatio: 20,
  createdAt: '2026-09-01T10:05:00+09:00',
};

export const SEED_UPLOAD_BATCH: UploadBatchEntity = {
  id: BATCH_ID,
  userId: USER_ID,
  sourceType: '승인내역',
  cardIssuer: '국민',
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  fileHash: 'sha256:seed-batch-0000000000000000000000000000000000000000000000000000',
  transactionCount: 24,
  skippedDuplicateCount: 0,
  classificationPendingCount: 1,
  createdAt: '2026-09-12T13:58:00+09:00',
};

export const SEED_JUDGMENT_RUN: JudgmentRunEntity = {
  id: RUN_ID,
  batchId: BATCH_ID,
  contextId: CONTEXT_ID,
  contextVersion: 1,
  totalCount: 23, // 24건 중 미분류(tx1023) 1건은 classificationStatus!=CLASSIFIED라 대상 제외
  failedCount: 0,
  startedAt: '2026-09-12T14:01:00+09:00',
  completedAt: '2026-09-12T14:05:00+09:00',
  pollCount: 99, // 시딩 직후 조회 시 바로 COMPLETED로 보이도록 완료 임계치 이상으로 설정
};

interface RawTransaction {
  seq: number;
  approvedAt: string;
  merchantRaw: string;
  merchantNorm: string;
  merchantCategory: string;
  amount: number;
  installmentMonths: number;
}

const RAW_TRANSACTIONS: RawTransaction[] = [
  { seq: 1001, approvedAt: '2026-01-03', merchantRaw: 'AWS APN1', merchantNorm: 'Amazon Web Services', merchantCategory: '해외SaaS', amount: 137_000, installmentMonths: 0 },
  { seq: 1002, approvedAt: '2026-01-05', merchantRaw: 'GITHUB INC', merchantNorm: 'GitHub', merchantCategory: '해외SaaS', amount: 27_500, installmentMonths: 0 },
  { seq: 1003, approvedAt: '2026-01-08', merchantRaw: '(주)한국애플 온라인', merchantNorm: 'Apple 대한민국', merchantCategory: '전자기기', amount: 3_490_000, installmentMonths: 12 },
  { seq: 1004, approvedAt: '2026-01-10', merchantRaw: 'ADOBE SYSTEMS SOFTWARE', merchantNorm: 'Adobe', merchantCategory: '해외SaaS', amount: 660_000, installmentMonths: 0 },
  { seq: 1005, approvedAt: '2026-01-12', merchantRaw: '스타벅스코리아 서면점', merchantNorm: '스타벅스', merchantCategory: '카페', amount: 12_800, installmentMonths: 0 },
  { seq: 1006, approvedAt: '2026-01-14', merchantRaw: '카카오모빌리티', merchantNorm: '카카오 T', merchantCategory: '여비교통', amount: 9_400, installmentMonths: 0 },
  { seq: 1007, approvedAt: '2026-01-15', merchantRaw: 'SKT 이용요금', merchantNorm: 'SK텔레콤', merchantCategory: '통신', amount: 78_000, installmentMonths: 0 },
  { seq: 1008, approvedAt: '2026-01-16', merchantRaw: '(주)이지스자산관리 관리비', merchantNorm: '자택 관리비', merchantCategory: '수도광열', amount: 184_000, installmentMonths: 0 },
  { seq: 1009, approvedAt: '2026-01-17', merchantRaw: '이마트 하단점', merchantNorm: '이마트', merchantCategory: '생활용품', amount: 96_300, installmentMonths: 0 },
  { seq: 1010, approvedAt: '2026-01-18', merchantRaw: '부산은퇴자골프클럽', merchantNorm: '골프장', merchantCategory: '여가', amount: 240_000, installmentMonths: 0 },
  { seq: 1011, approvedAt: '2026-01-19', merchantRaw: '서울대학교병원', merchantNorm: '병원', merchantCategory: '의료', amount: 62_000, installmentMonths: 0 },
  { seq: 1012, approvedAt: '2026-01-20', merchantRaw: '국세청 국세납부', merchantNorm: '국세 납부', merchantCategory: '조세', amount: 1_240_000, installmentMonths: 0 },
  { seq: 1013, approvedAt: '2026-01-21', merchantRaw: 'NOTION LABS INC', merchantNorm: 'Notion', merchantCategory: '해외SaaS', amount: 14_300, installmentMonths: 0 },
  { seq: 1014, approvedAt: '2026-01-22', merchantRaw: '교보문고 광화문', merchantNorm: '교보문고', merchantCategory: '도서', amount: 38_000, installmentMonths: 0 },
  { seq: 1015, approvedAt: '2026-01-23', merchantRaw: '위워크 서면 데스크', merchantNorm: 'WeWork', merchantCategory: '임차료', amount: 330_000, installmentMonths: 0 },
  { seq: 1016, approvedAt: '2026-01-24', merchantRaw: '한우마을 본점', merchantNorm: '한우마을', merchantCategory: '음식점', amount: 412_000, installmentMonths: 0 },
  { seq: 1017, approvedAt: '2026-01-25', merchantRaw: 'GS25 대연동', merchantNorm: 'GS25', merchantCategory: '편의점', amount: 8_600, installmentMonths: 0 },
  { seq: 1018, approvedAt: '2026-01-26', merchantRaw: 'KTX 승차권 부산-서울', merchantNorm: '한국철도공사', merchantCategory: '여비교통', amount: 119_600, installmentMonths: 0 },
  { seq: 1019, approvedAt: '2026-01-27', merchantRaw: '롯데백화점 상품권', merchantNorm: '백화점 상품권', merchantCategory: '기타', amount: 500_000, installmentMonths: 0 },
  { seq: 1020, approvedAt: '2026-01-28', merchantRaw: 'NETFLIX.COM', merchantNorm: 'Netflix', merchantCategory: '구독서비스', amount: 17_000, installmentMonths: 0 },
  { seq: 1021, approvedAt: '2026-01-29', merchantRaw: '오피스디포 데스크체어', merchantNorm: '오피스디포', merchantCategory: '사무용품', amount: 420_000, installmentMonths: 3 },
  { seq: 1022, approvedAt: '2026-01-30', merchantRaw: '유니세프한국위원회', merchantNorm: '유니세프', merchantCategory: '기타', amount: 300_000, installmentMonths: 0 },
  { seq: 1023, approvedAt: '2026-01-31', merchantRaw: 'ELEVENLABS IO', merchantNorm: '미확인 가맹점', merchantCategory: '미분류', amount: 33_000, installmentMonths: 0 },
  { seq: 1024, approvedAt: '2026-01-31', merchantRaw: 'SK에너지 대연주유소', merchantNorm: 'SK에너지', merchantCategory: '차량', amount: 70_000, installmentMonths: 0 },
];

export const txId = (seq: number) => `0199c8f2-0000-7000-8000-00000000${seq}`;
export const judgmentId = (seq: number) => `0199f1c3-0000-7000-8000-00000000${seq}`;

export const SEED_TRANSACTIONS: TransactionEntity[] = RAW_TRANSACTIONS.map((raw) => ({
  id: txId(raw.seq),
  batchId: BATCH_ID,
  approvedAt: raw.approvedAt,
  merchantRaw: raw.merchantRaw,
  merchantNorm: raw.merchantNorm,
  merchantCategory: raw.merchantCategory,
  classificationStatus: raw.merchantCategory === '미분류' ? 'NEEDS_REVIEW' : 'CLASSIFIED',
  amount: raw.amount,
  installmentMonths: raw.installmentMonths,
  naturalKey: `nk-${raw.seq}`,
  sourceStatus: 'JUDGEABLE',
  userInclusion: 'AUTO',
}));

interface RawJudgment {
  seq: number;
  verdict: JudgmentEntity['verdict'];
  blockedAtGate: string | null;
  account: string | null;
  finalAmount: number | null;
  explanation: string;
  citations: { statuteVersionId: number; statuteId: string }[];
  /** 룰엔진 판정 범위 밖(핸드오프)인지. NEEDS_REVIEW일 때만 true. 생략 시 false. */
  outOfScope?: boolean;
}

const RAW_JUDGMENTS: RawJudgment[] = [
  { seq: 1001, verdict: 'AVAILABLE', blockedAtGate: null, account: '지급수수료', finalAmount: 137_000, explanation: '소프트웨어 개발업(62010)에서 서비스 운영을 위한 클라우드 사용료는 사업 수행에 직접 대응하는 비용으로, 동일 업종에서 통상적으로 지출됩니다.', citations: [{ statuteVersionId: 1418, statuteId: '소득세법-27-1' }, { statuteVersionId: 1529, statuteId: '소득세법시행령-55-1-13' }] },
  { seq: 1002, verdict: 'AVAILABLE', blockedAtGate: null, account: '지급수수료', finalAmount: 27_500, explanation: '개발 업무에 사용하는 코드 저장소 구독료로, 사업 수행에 직접 사용되는 용역의 대가에 해당합니다.', citations: [{ statuteVersionId: 1418, statuteId: '소득세법-27-1' }, { statuteVersionId: 1529, statuteId: '소득세법시행령-55-1-13' }] },
  { seq: 1003, verdict: 'AVAILABLE', blockedAtGate: null, account: '소모품비', finalAmount: 640_166, explanation: '취득가액 100만원을 초과하는 사업용 자산으로 감가상각 대상입니다. 승인 기준 원금 전액을 취득가액으로 보고, 2026년 귀속분은 내용연수 5년 정액법 · 사업연도 중 11개월분만 산입합니다.', citations: [{ statuteVersionId: 1523, statuteId: '소득세법시행령-55-1-7' }, { statuteVersionId: 1544, statuteId: '소득세법시행령-62-1' }] },
  { seq: 1004, verdict: 'NEEDS_REVIEW', blockedAtGate: 'G3', account: '지급수수료', finalAmount: null, explanation: '연간 일시납 구독으로 보이나 서비스 제공 기간이 확인되지 않습니다. 기간이 다음 과세연도에 걸치면 선급비용으로 안분해야 하므로 전액 산입할 수 없습니다.', citations: [{ statuteVersionId: 1418, statuteId: '소득세법-27-1' }] },
  { seq: 1005, verdict: 'NEEDS_REVIEW', blockedAtGate: 'G2', account: '소모품비', finalAmount: null, explanation: '1인 사업자의 단독 카페 이용은 세무 실무에서도 판단이 갈리는 항목입니다. 지출 목적이 확인되지 않아 단정하지 않고 확인 필요로 고정합니다.', citations: [{ statuteVersionId: 1418, statuteId: '소득세법-27-1' }] },
  { seq: 1006, verdict: 'NEEDS_REVIEW', blockedAtGate: 'G2', account: '여비교통비', finalAmount: null, explanation: '이동 목적이 업무인지 사적인지 거래 내역만으로는 구분되지 않습니다. 목적 확인 후 재판정합니다.', citations: [{ statuteVersionId: 1418, statuteId: '소득세법-27-1' }] },
  { seq: 1007, verdict: 'NEEDS_REVIEW', blockedAtGate: 'G3', account: '소모품비', finalAmount: null, explanation: '사업과 가사에 공통으로 관련되는 경비입니다. 사업 사용 비율이 객관적으로 구분되는 범위에서만 산입할 수 있으므로 안분율이 필요합니다.', citations: [{ statuteVersionId: 1435, statuteId: '소득세법-33-1-5' }] },
  { seq: 1008, verdict: 'NEEDS_REVIEW', blockedAtGate: 'G3', account: '소모품비', finalAmount: null, explanation: '자택을 작업공간으로 사용한다고 문진에서 응답했습니다(면적 비율 20%). 다만 이 지출이 작업공간에 대응하는 부분인지 확인이 필요합니다.', citations: [{ statuteVersionId: 1435, statuteId: '소득세법-33-1-5' }] },
  { seq: 1009, verdict: 'UNAVAILABLE', blockedAtGate: 'G1', account: null, finalAmount: null, explanation: '직원이 없는 1인 사업자의 대형마트 식료품 구매는 가사에 관련되는 경비로 봅니다. 사업에 직접 관련되는 부분이 명백히 구분되지 않습니다.', citations: [{ statuteVersionId: 1435, statuteId: '소득세법-33-1-5' }, { statuteVersionId: 3480, statuteId: '대법원-2019두12345' }] },
  { seq: 1010, verdict: 'UNAVAILABLE', blockedAtGate: 'G1', account: null, finalAmount: null, explanation: '업무와 관련 없는 지출로 열거된 항목에 해당합니다. 거래처 접대 사실이 확인되는 경우에도 접대비 한도 규정이 별도로 적용됩니다.', citations: [{ statuteVersionId: 1447, statuteId: '소득세법-33-1-13' }, { statuteVersionId: 1449, statuteId: '소득세법-33-1-14' }] },
  { seq: 1011, verdict: 'UNAVAILABLE', blockedAtGate: 'G1', account: null, finalAmount: null, explanation: '본인 의료비는 가사 관련 경비로 필요경비에 산입하지 않습니다. 종합소득세 신고 시 의료비 세액공제 항목으로는 별도 검토할 수 있습니다.', citations: [{ statuteVersionId: 1435, statuteId: '소득세법-33-1-5' }] },
  { seq: 1012, verdict: 'UNAVAILABLE', blockedAtGate: 'G1', account: null, finalAmount: null, explanation: '소득세와 개인지방소득세는 필요경비 불산입 항목으로 법에 직접 열거되어 있습니다.', citations: [{ statuteVersionId: 1431, statuteId: '소득세법-33-1-1' }] },
  { seq: 1013, verdict: 'AVAILABLE', blockedAtGate: null, account: '지급수수료', finalAmount: 14_300, explanation: '업무 문서·일정 관리 도구 구독료로 사업에 직접 사용되는 용역의 대가에 해당합니다.', citations: [{ statuteVersionId: 1418, statuteId: '소득세법-27-1' }, { statuteVersionId: 1529, statuteId: '소득세법시행령-55-1-13' }] },
  { seq: 1014, verdict: 'AVAILABLE', blockedAtGate: null, account: '도서인쇄비', finalAmount: 38_000, explanation: '업종과 직접 관련된 기술 서적 구입비로, 동일 업종에서 통상적으로 지출되는 비용입니다.', citations: [{ statuteVersionId: 1418, statuteId: '소득세법-27-1' }, { statuteVersionId: 2071, statuteId: '기본통칙-27-1' }] },
  { seq: 1015, verdict: 'AVAILABLE', blockedAtGate: null, account: '소모품비', finalAmount: 330_000, explanation: '사업 수행 장소의 임차료로, 사업용 자산의 임차료 항목에 직접 해당합니다.', citations: [{ statuteVersionId: 1529, statuteId: '소득세법시행령-55-1-13' }, { statuteVersionId: 1418, statuteId: '소득세법-27-1' }] },
  { seq: 1016, verdict: 'AVAILABLE', blockedAtGate: null, account: '소모품비', finalAmount: 412_000, explanation: '거래처 접대 목적이 확인된 지출로 접대비 버킷에 태그했습니다. 연말 한도 확정 시 초과분은 불산입으로 조정됩니다.', citations: [{ statuteVersionId: 1449, statuteId: '소득세법-33-1-14' }, { statuteVersionId: 1418, statuteId: '소득세법-27-1' }] },
  { seq: 1017, verdict: 'NEEDS_REVIEW', blockedAtGate: 'G2', account: '소모품비', finalAmount: null, explanation: '편의점 지출은 품목에 따라 업무 관련성이 달라집니다. 목적이 확인되지 않아 확인 필요로 둡니다.', citations: [{ statuteVersionId: 1418, statuteId: '소득세법-27-1' }] },
  { seq: 1018, verdict: 'AVAILABLE', blockedAtGate: null, account: '여비교통비', finalAmount: 119_600, explanation: '거래처 방문 사실이 이전 응답으로 저장되어 있어(사실 저장소) 업무 관련 여비로 판정했습니다.', citations: [{ statuteVersionId: 1418, statuteId: '소득세법-27-1' }, { statuteVersionId: 1529, statuteId: '소득세법시행령-55-1-13' }] },
  { seq: 1019, verdict: 'UNAVAILABLE', blockedAtGate: 'G1', account: null, finalAmount: null, explanation: '상품권 구입 자체는 사용처가 확인되지 않아 업무 관련 지출로 볼 수 없습니다. 실제 사용 내역으로 별도 증빙이 필요합니다.', citations: [{ statuteVersionId: 1447, statuteId: '소득세법-33-1-13' }] },
  { seq: 1020, verdict: 'UNAVAILABLE', blockedAtGate: 'G2', account: null, finalAmount: null, explanation: '소프트웨어 개발업에서 영상 스트리밍 구독은 동일 업종의 통상적 지출로 인정되지 않습니다.', citations: [{ statuteVersionId: 1418, statuteId: '소득세법-27-1' }, { statuteVersionId: 2071, statuteId: '기본통칙-27-1' }] },
  { seq: 1021, verdict: 'AVAILABLE', blockedAtGate: null, account: '소모품비', finalAmount: 420_000, explanation: '취득가액이 거래단위별 100만원 이하인 사무용 자산으로, 사용한 과세기간의 필요경비로 계상할 수 있습니다. 3개월 할부이나 승인 기준 원금 전액으로 봅니다.', citations: [{ statuteVersionId: 1544, statuteId: '소득세법시행령-62-1' }, { statuteVersionId: 1418, statuteId: '소득세법-27-1' }] },
  { seq: 1022, verdict: 'NEEDS_REVIEW', blockedAtGate: 'G5', account: '소모품비', finalAmount: null, explanation: '기부금 한도는 연간 소득금액이 확정된 후 계산됩니다. 현재는 잠정 상태로, 한도 초과분은 이후 과세기간으로 이월됩니다.', citations: [{ statuteVersionId: 1462, statuteId: '소득세법-34-1' }] },
  // 1023: 미분류 → Rule Engine에 전달하지 않음 (Judgment 없음, ClassificationReview만 존재)
  { seq: 1024, verdict: 'UNAVAILABLE', blockedAtGate: 'G1', account: null, finalAmount: null, explanation: '문진에서 사업용 차량을 보유하지 않는다고 응답했습니다. 사업용 차량이 없으므로 유류비는 가사 관련 경비로 봅니다.', citations: [{ statuteVersionId: 1435, statuteId: '소득세법-33-1-5' }] },
];

export const SEED_JUDGMENTS: JudgmentEntity[] = RAW_JUDGMENTS.map((raw, index) => ({
  id: judgmentId(raw.seq),
  transactionId: txId(raw.seq),
  revision: 1,
  origin: { type: 'RUN', id: RUN_ID },
  runId: RUN_ID,
  verdict: raw.verdict,
  outOfScope: raw.outOfScope ?? false,
  blockedAtGate: raw.blockedAtGate,
  account: raw.account,
  finalAmount: raw.finalAmount,
  isInference: false,
  unmatchedReason: null,
  attributes: {},
  ruleCardId: `R-${300 + index}`,
  ruleCardVersion: 1,
  appliedRuleIds: [`R-${300 + index}`],
  rulesCommitSha: 'seed0000000000000000000000000000000000',
  userContextVersion: 1,
  explanation: raw.explanation,
  computedAt: '2026-09-12T14:05:00+09:00',
  citations: raw.citations,
}));

export const SEED_CLASSIFICATION_REVIEW: ClassificationReviewEntity = {
  id: REVIEW_ID,
  batchId: BATCH_ID,
  transactionId: txId(1023),
  merchantRaw: 'ELEVENLABS IO',
  merchantNorm: '미확인 가맹점',
  status: 'PENDING',
  suggestedCategories: ['해외SaaS', '국내SW', '기타'],
  createdAt: '2026-09-12T13:59:00+09:00',
  resolvedAt: null,
};

interface RawQuestionGroup {
  groupKey: string;
  factType: string;
  questionText: string;
  options: string[];
  seqs: number[];
  /** 답변 라벨 → 재판정 verdict. question-responses가 이 룩업으로 rev2 verdict를 정한다. */
  answerVerdicts: Record<string, JudgmentEntity['verdict']>;
}

/**
 * docs/api.md 3.10 "UserFact 범위" 예시는 scopeKey를 `merchant:스타벅스`처럼 상호 1개
 * 단위로 든다. 예전에는 "카페 · 편의점"(스타벅스+GS25), "통신비 · 자택 관리비"(SK텔레콤+
 * 관리비)처럼 서로 다른 상호를 한 groupKey로 묶어놨었는데, 그러면 스타벅스에 대한 답변이
 * GS25에는 적용되지 않아야 하는데도 구분할 방법이 없어진다. 상호 1개 = groupKey(scope)
 * 1개로 쪼갠다.
 */
export const RAW_QUESTION_GROUPS: RawQuestionGroup[] = [
  {
    groupKey: 'merchant:스타벅스',
    factType: '용도',
    questionText: '이 가맹점에서 쓴 비용은 주로 어떤 목적이었나요?',
    options: ['사업', '개인', '혼용'],
    seqs: [1005],
    answerVerdicts: { 사업: 'AVAILABLE', 개인: 'UNAVAILABLE', 혼용: 'NEEDS_REVIEW' },
  },
  {
    groupKey: 'merchant:GS25',
    factType: '용도',
    questionText: '이 가맹점에서 쓴 비용은 주로 어떤 목적이었나요?',
    options: ['사업', '개인', '혼용'],
    seqs: [1017],
    answerVerdicts: { 사업: 'AVAILABLE', 개인: 'UNAVAILABLE', 혼용: 'NEEDS_REVIEW' },
  },
  {
    groupKey: 'merchant:카카오 T',
    factType: '용도',
    questionText: '이 이동은 업무 목적이었나요?',
    options: ['사업', '개인', '혼용'],
    seqs: [1006],
    answerVerdicts: { 사업: 'AVAILABLE', 개인: 'UNAVAILABLE', 혼용: 'NEEDS_REVIEW' },
  },
  {
    groupKey: 'merchant:SK텔레콤',
    factType: '안분비율',
    questionText: '업무용으로 쓰는 비율은 몇 %인가요?',
    options: ['20%', '50%', '80%'],
    seqs: [1007],
    answerVerdicts: { '20%': 'AVAILABLE', '50%': 'AVAILABLE', '80%': 'AVAILABLE' },
  },
  {
    groupKey: 'merchant:자택 관리비',
    factType: '안분비율',
    questionText: '업무용으로 쓰는 비율은 몇 %인가요?',
    options: ['20%', '50%', '80%'],
    seqs: [1008],
    answerVerdicts: { '20%': 'AVAILABLE', '50%': 'AVAILABLE', '80%': 'AVAILABLE' },
  },
  {
    groupKey: 'merchant:Adobe',
    factType: '서비스기간',
    questionText: '이 결제가 커버하는 서비스 기간은 어떻게 되나요?',
    options: ['올해 안에 끝남', '다음 해까지 걸침', '모르겠음'],
    seqs: [1004],
    answerVerdicts: { '올해 안에 끝남': 'AVAILABLE', '다음 해까지 걸침': 'AVAILABLE', '모르겠음': 'NEEDS_REVIEW' },
  },
];

export const QUESTION_ANSWER_VERDICT: Record<string, Record<string, JudgmentEntity['verdict']>> = Object.fromEntries(
  RAW_QUESTION_GROUPS.map((group) => [group.groupKey, group.answerVerdicts]),
);

export const SEED_QUESTIONS: QuestionEntity[] = RAW_QUESTION_GROUPS.flatMap((group, groupIndex) =>
  group.seqs.map((seq, memberIndex) => ({
    id: `0199a1b2-0000-7000-8000-0000000${groupIndex}0${memberIndex}`,
    batchId: BATCH_ID,
    transactionId: txId(seq),
    groupKey: group.groupKey,
    factType: group.factType,
    questionText: group.questionText,
    options: group.options,
    status: 'PENDING' as const,
    answeredFactId: null,
    createdAt: '2026-09-12T14:05:30+09:00',
    answeredAt: null,
  })),
);

const HIERARCHY_BY_PREFIX: [string, string][] = [
  ['소득세법시행령', '시행령'],
  ['소득세법', '법률'],
  ['기본통칙', '기본통칙'],
  ['대법원', '판례'],
  ['조심', '판례'],
];

function hierarchyOf(statuteId: string): string {
  const match = HIERARCHY_BY_PREFIX.find(([prefix]) => statuteId.startsWith(prefix));
  return match?.[1] ?? '기타';
}

interface RawStatute {
  statuteVersionId: number;
  statuteId: string;
  title: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceUrl: string;
  body: string;
}

const RAW_STATUTES: RawStatute[] = [
  { statuteVersionId: 1418, statuteId: '소득세법-27-1', title: '소득세법 제27조 제1항', effectiveFrom: '2025-01-01', effectiveTo: null, sourceUrl: 'https://www.law.go.kr/', body: '거주자의 각 소득에 대한 총수입금액을 계산할 때 필요경비에 산입할 금액은 해당 과세기간에 총수입금액에 대응하는 비용으로서 일반적으로 용인되는 통상적인 것의 합계액으로 한다.' },
  { statuteVersionId: 1431, statuteId: '소득세법-33-1-1', title: '소득세법 제33조 제1항 제1호', effectiveFrom: '2025-01-01', effectiveTo: null, sourceUrl: 'https://www.law.go.kr/', body: '다음 각 호의 어느 하나에 해당하는 것은 필요경비에 산입하지 아니한다. 1. 소득세와 개인지방소득세' },
  { statuteVersionId: 1435, statuteId: '소득세법-33-1-5', title: '소득세법 제33조 제1항 제5호', effectiveFrom: '2025-01-01', effectiveTo: null, sourceUrl: 'https://www.law.go.kr/', body: '가사(家事)의 관련되는 경비와 대통령령으로 정하는 것은 필요경비에 산입하지 아니한다. 다만, 사업과 가사에 공통으로 관련되는 경비로서 그 사업에 직접 관련되는 부분이 명백히 구분되는 경우 그 구분되는 금액은 필요경비로 한다.' },
  { statuteVersionId: 1447, statuteId: '소득세법-33-1-13', title: '소득세법 제33조 제1항 제13호', effectiveFrom: '2025-01-01', effectiveTo: null, sourceUrl: 'https://www.law.go.kr/', body: '업무와 관련 없는 지출로서 대통령령으로 정하는 것은 필요경비에 산입하지 아니한다.' },
  { statuteVersionId: 1449, statuteId: '소득세법-33-1-14', title: '소득세법 제33조 제1항 제14호', effectiveFrom: '2025-01-01', effectiveTo: null, sourceUrl: 'https://www.law.go.kr/', body: '대통령령으로 정하는 한도를 초과하는 접대비는 필요경비에 산입하지 아니한다. 접대비란 업무와 관련하여 거래처를 접대·향응하기 위하여 지출한 금액을 말한다.' },
  { statuteVersionId: 1462, statuteId: '소득세법-34-1', title: '소득세법 제34조 제1항', effectiveFrom: '2025-01-01', effectiveTo: null, sourceUrl: 'https://www.law.go.kr/', body: '사업자가 지출한 기부금 중 대통령령으로 정하는 한도를 초과하는 금액은 해당 과세기간의 필요경비에 산입하지 아니하며, 초과액은 이후 과세기간으로 이월하여 필요경비에 산입할 수 있다.' },
  { statuteVersionId: 1523, statuteId: '소득세법시행령-55-1-7', title: '소득세법 시행령 제55조 제1항 제7호', effectiveFrom: '2025-02-28', effectiveTo: null, sourceUrl: 'https://www.law.go.kr/', body: '사업소득의 필요경비는 다음 각 호에 규정하는 것으로 한다. 7. 사업용 자산에 대한 감가상각비. 이 경우 감가상각비는 상각범위액을 한도로 하여 필요경비에 산입한다.' },
  { statuteVersionId: 1529, statuteId: '소득세법시행령-55-1-13', title: '소득세법 시행령 제55조 제1항 제13호', effectiveFrom: '2025-02-28', effectiveTo: null, sourceUrl: 'https://www.law.go.kr/', body: '사업소득의 필요경비는 다음 각 호에 규정하는 것으로 한다. 13. 사업용 자산의 임차료, 그 밖에 사업에 직접 사용되는 재화·용역의 대가' },
  { statuteVersionId: 1544, statuteId: '소득세법시행령-62-1', title: '소득세법 시행령 제62조 제1항', effectiveFrom: '2025-02-28', effectiveTo: null, sourceUrl: 'https://www.law.go.kr/', body: '감가상각자산의 취득가액이 거래단위별로 100만원 이하인 경우로서 대통령령으로 정하는 것은 이를 사업에 사용한 날이 속하는 과세기간의 필요경비로 계상할 수 있다.' },
  { statuteVersionId: 2071, statuteId: '기본통칙-27-1', title: '소득세법 기본통칙 27-1', effectiveFrom: '2023-04-11', effectiveTo: null, sourceUrl: 'https://www.law.go.kr/', body: '필요경비의 통상성은 동일한 사업을 영위하는 다른 사업자가 같은 상황에서 통상적으로 지출하였을 것인지를 기준으로 판단한다. 사업자의 개별적 사정만으로 통상성이 인정되지 아니한다.' },
  { statuteVersionId: 3312, statuteId: '조심-2021-서-1834', title: '조심 2021서1834', effectiveFrom: '2021-09-14', effectiveTo: null, sourceUrl: 'https://www.law.go.kr/', body: '청구인이 단독으로 이용한 커피전문점 지출액은 업무수행 장소로 사용하였다는 객관적 자료가 확인되지 아니하는 한 업무관련성을 인정하기 어렵다고 판단하였다.' },
  { statuteVersionId: 3480, statuteId: '대법원-2019두12345', title: '대법원 2019두12345 (법원의 판단)', effectiveFrom: '2020-02-13', effectiveTo: null, sourceUrl: 'https://www.law.go.kr/', body: '법원의 판단: 사업과 가사에 공통으로 사용되는 자산의 비용은 사업 사용 비율이 객관적으로 구분되는 범위에서만 필요경비로 인정된다.' },
];

export const SEED_STATUTES: StatuteEntity[] = RAW_STATUTES.map((raw) => ({
  ...raw,
  hierarchy: hierarchyOf(raw.statuteId),
}));
