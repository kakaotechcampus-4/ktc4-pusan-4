package com.ktc4.pusan4.judgment.persistence;

import java.util.List;
import java.util.UUID;

/** 판정 대상 조건(TransactionConditions)을 쓰는 거래 조회. 구현은 QueryDSL 이다. */
public interface TransactionRecordRepositoryCustom {

    // run 대상: 지금 판정 대상인 거래(api.md 3.6). 정렬: approvedAt, id.
    List<UUID> findRunTargetIds(UUID batchId);

    // 가맹점 단위 답(api.md 3.10)이 바꾸는 거래 중 다시 판정할 거래. 지금 판정 대상이면서
    // 판정한 적이 있는 거래만 고른다. 분류 전·제외·아직 run 이 돌지 않은 거래에 run 밖 판정을 만들지 않는다.
    List<UUID> findJudgedTargetIdsByMerchant(UUID batchId, String merchantNorm);
}
