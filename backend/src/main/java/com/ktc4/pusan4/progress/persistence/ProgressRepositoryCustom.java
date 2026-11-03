package com.ktc4.pusan4.progress.persistence;

import com.ktc4.pusan4.progress.persistence.ProgressRepository.Pending;

import java.util.UUID;

/** 판정 대상 조건(TransactionConditions)을 쓰는 진행 상황 조회. 구현은 QueryDSL 이다. */
interface ProgressRepositoryCustom {

    // 지금 판정 대상(effectiveStatus = JUDGEABLE)인 거래의 대기 중 분류 검토 수와 금액.
    // 업로드 목록의 classificationPendingCount 와 같은 조건이다(UploadBatchCountRepository.countPendingReviews).
    Pending countPendingClassification(UUID batchId);
}
