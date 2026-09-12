import type { Statute } from '../types/domain';

/**
 * 판정이 실제로 읽은 조문 버전. 귀속연도 2026 기준.
 * append-only 저장을 전제로 statuteVersionId를 고정한다.
 */
export const STATUTES: Record<string, Statute> = {
  '소득세법-27-1': {
    statuteId: '소득세법-27-1',
    label: '소득세법 제27조 제1항',
    hierarchy: '법률',
    role: 'EVIDENCE',
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    statuteVersionId: 1418,
    body: '거주자의 각 소득에 대한 총수입금액을 계산할 때 필요경비에 산입할 금액은 해당 과세기간에 총수입금액에 대응하는 비용으로서 일반적으로 용인되는 통상적인 것의 합계액으로 한다.'
  },
  '소득세법-33-1-1': {
    statuteId: '소득세법-33-1-1',
    label: '소득세법 제33조 제1항 제1호',
    hierarchy: '법률',
    role: 'EVIDENCE',
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    statuteVersionId: 1431,
    body: '다음 각 호의 어느 하나에 해당하는 것은 필요경비에 산입하지 아니한다. 1. 소득세와 개인지방소득세'
  },
  '소득세법-33-1-5': {
    statuteId: '소득세법-33-1-5',
    label: '소득세법 제33조 제1항 제5호',
    hierarchy: '법률',
    role: 'EVIDENCE',
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    statuteVersionId: 1435,
    body: '가사(家事)의 관련되는 경비와 대통령령으로 정하는 것은 필요경비에 산입하지 아니한다. 다만, 사업과 가사에 공통으로 관련되는 경비로서 그 사업에 직접 관련되는 부분이 명백히 구분되는 경우 그 구분되는 금액은 필요경비로 한다.'
  },
  '소득세법-33-1-13': {
    statuteId: '소득세법-33-1-13',
    label: '소득세법 제33조 제1항 제13호',
    hierarchy: '법률',
    role: 'EVIDENCE',
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    statuteVersionId: 1447,
    body: '업무와 관련 없는 지출로서 대통령령으로 정하는 것은 필요경비에 산입하지 아니한다.'
  },
  '소득세법-33-1-14': {
    statuteId: '소득세법-33-1-14',
    label: '소득세법 제33조 제1항 제14호',
    hierarchy: '법률',
    role: 'EVIDENCE',
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    statuteVersionId: 1449,
    body: '대통령령으로 정하는 한도를 초과하는 접대비는 필요경비에 산입하지 아니한다. 접대비란 업무와 관련하여 거래처를 접대·향응하기 위하여 지출한 금액을 말한다.'
  },
  '소득세법-34-1': {
    statuteId: '소득세법-34-1',
    label: '소득세법 제34조 제1항',
    hierarchy: '법률',
    role: 'EVIDENCE',
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    statuteVersionId: 1462,
    body: '사업자가 지출한 기부금 중 대통령령으로 정하는 한도를 초과하는 금액은 해당 과세기간의 필요경비에 산입하지 아니하며, 초과액은 이후 과세기간으로 이월하여 필요경비에 산입할 수 있다.'
  },
  '소득세법시행령-55-1-7': {
    statuteId: '소득세법시행령-55-1-7',
    label: '소득세법 시행령 제55조 제1항 제7호',
    hierarchy: '시행령',
    role: 'EVIDENCE',
    effectiveFrom: '2025-02-28',
    effectiveTo: null,
    statuteVersionId: 1523,
    body: '사업소득의 필요경비는 다음 각 호에 규정하는 것으로 한다. 7. 사업용 자산에 대한 감가상각비. 이 경우 감가상각비는 상각범위액을 한도로 하여 필요경비에 산입한다.'
  },
  '소득세법시행령-55-1-13': {
    statuteId: '소득세법시행령-55-1-13',
    label: '소득세법 시행령 제55조 제1항 제13호',
    hierarchy: '시행령',
    role: 'EVIDENCE',
    effectiveFrom: '2025-02-28',
    effectiveTo: null,
    statuteVersionId: 1529,
    body: '사업소득의 필요경비는 다음 각 호에 규정하는 것으로 한다. 13. 사업용 자산의 임차료, 그 밖에 사업에 직접 사용되는 재화·용역의 대가'
  },
  '소득세법시행령-62-1': {
    statuteId: '소득세법시행령-62-1',
    label: '소득세법 시행령 제62조 제1항',
    hierarchy: '시행령',
    role: 'EVIDENCE',
    effectiveFrom: '2025-02-28',
    effectiveTo: null,
    statuteVersionId: 1544,
    body: '감가상각자산의 취득가액이 거래단위별로 100만원 이하인 경우로서 대통령령으로 정하는 것은 이를 사업에 사용한 날이 속하는 과세기간의 필요경비로 계상할 수 있다.'
  },
  '기본통칙-27-1': {
    statuteId: '기본통칙-27-1',
    label: '소득세법 기본통칙 27-1',
    hierarchy: '기본통칙',
    role: 'REFERENCE',
    effectiveFrom: '2023-04-11',
    effectiveTo: null,
    statuteVersionId: 2071,
    body: '필요경비의 통상성은 동일한 사업을 영위하는 다른 사업자가 같은 상황에서 통상적으로 지출하였을 것인지를 기준으로 판단한다. 사업자의 개별적 사정만으로 통상성이 인정되지 아니한다.'
  },
  '조심-2021-서-1834': {
    statuteId: '조심-2021-서-1834',
    label: '조심 2021서1834',
    hierarchy: '심판례',
    role: 'REFERENCE',
    effectiveFrom: '2021-09-14',
    effectiveTo: null,
    statuteVersionId: 3312,
    body: '청구인이 단독으로 이용한 커피전문점 지출액은 업무수행 장소로 사용하였다는 객관적 자료가 확인되지 아니하는 한 업무관련성을 인정하기 어렵다고 판단하였다.'
  },
  '대법원-2019두12345': {
    statuteId: '대법원-2019두12345',
    label: '대법원 2019두12345 (법원의 판단)',
    hierarchy: '판례',
    role: 'REFERENCE',
    effectiveFrom: '2020-02-13',
    effectiveTo: null,
    statuteVersionId: 3480,
    body: '법원의 판단: 사업과 가사에 공통으로 사용되는 자산의 비용은 사업 사용 비율이 객관적으로 구분되는 범위에서만 필요경비로 인정된다.'
  }
};

export const statuteOf = (statuteId: string): Statute | undefined =>
STATUTES[statuteId];