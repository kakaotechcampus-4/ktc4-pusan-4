package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.transaction.persistence.UploadBatchCountRepository.BatchCount;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** 판정 대상 조건(TransactionConditions)을 쓰는 업로드 배치 건수. 구현은 QueryDSL 이다. */
interface UploadBatchCountRepositoryCustom {

    // 판정 대상(effectiveStatus = JUDGEABLE) 거래의 대기 중 검토만 batch 별로 센다. 제외해도 검토는 남아 다시 포함하면 돌아온다.
    // 검토는 미분류 거래에만 붙으므로 분류 완료 조건은 넣지 않는다.
    List<BatchCount> countPendingReviews(Collection<UUID> batchIds);
}
