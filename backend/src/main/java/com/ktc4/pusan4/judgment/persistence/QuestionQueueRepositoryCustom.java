package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.persistence.QuestionQueueRepository.QuestionRow;

import java.util.List;
import java.util.UUID;

/** 판정 대상 조건(TransactionConditions)을 쓰는 질문 조회. 구현은 QueryDSL 이다. */
interface QuestionQueueRepositoryCustom {

    // 질문 목록 (api.md 3.9). 질문은 판정 → 거래를 거쳐 사용자에 닿는다. batchId·transactionId 는 비어 있으면 걸지 않는다.
    // 지금 판정 대상인 거래의 질문만 남긴다. 질문은 지우지 않으므로 거래를 다시 포함하면 돌아온다.
    // 거래를 지정해도 거른다(api.md 3.9). 정렬: createdAt, id.
    List<QuestionRow> findRows(UUID userId, UUID batchId, UUID transactionId);
}
