package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.transaction.persistence.ClassificationReviewRepository.ReviewRow;

import java.util.List;
import java.util.UUID;

/** 판정 대상 조건(TransactionConditions)을 쓰는 분류 확인 요청 조회. 구현은 QueryDSL 이다. */
interface ClassificationReviewRepositoryCustom {

    /**
     * 이 batch 의 분류 확인 요청과 거래 요약. 정렬: createdAt ASC, id ASC (api.md 3.5).
     * 지금 판정 대상(effectiveStatus = JUDGEABLE)인 거래만 본다. 제외한 거래의 요청은 지우지 않고 여기서 거른다.
     */
    List<ReviewRow> findRows(UUID userId, UUID batchId);

    /** batchId 없이 부르면 사용자의 모든 batch. 정렬은 {@link #findRows(UUID, UUID)} 와 같다. */
    List<ReviewRow> findRows(UUID userId);
}
