package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.persistence.QuestionQueueRepository.QuestionRow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** 판정 대상 조건(TransactionConditions)을 쓰는 질문 조회. 구현은 QueryDSL 이다. */
interface QuestionQueueRepositoryCustom {

    // 질문 목록 (api.md 3.9). 질문은 판정 → 거래를 거쳐 사용자에 닿는다. batchId·transactionId 는 비어 있으면 걸지 않는다.
    // 지금 판정 대상인 거래의 질문만 남긴다. 질문은 지우지 않으므로 거래를 다시 포함하면 돌아온다.
    // 거래를 지정해도 거른다(api.md 3.9). 정렬: createdAt, id.
    List<QuestionRow> findRows(UUID userId, UUID batchId, UUID transactionId);

    // findRows 와 같은 조건의 PENDING 질문.
    List<QuestionRow> findPendingRows(UUID userId, UUID batchId);

    // findRows 와 같은 조건에 status 를 더해 한 쪽만 읽는다. status 가 비면 거르지 않는다.
    Page<QuestionRow> findRowsPage(UUID userId, UUID batchId, UUID transactionId, String status, Pageable pageable);

    // 미해소 집계(api.md 3.9): findRows 와 같은 조건의 PENDING 질문 수와, 그 질문이 걸린 거래의 결제 금액 합.
    // 한 거래에 질문이 여럿이어도 금액은 한 번만 더한다.
    PendingCount countPending(UUID userId, UUID batchId, UUID transactionId);

    // findRows 와 같은 조건에 status 를 더해, 묶기와 순서에 쓰는 값만 읽는다(grouped=true 의 한 쪽 고르기).
    List<MemberRow> findMembers(UUID userId, UUID batchId, UUID transactionId, String status);

    // 주어진 질문. 정렬: createdAt, id.
    List<QuestionRow> findRowsByIds(Collection<UUID> questionIds);

    // 주어진 거래 가운데 PENDING 질문이 남은 거래. 질문은 revision 마다 생기므로 거래의 모든 판정에서 찾는다.
    List<UUID> findPendingTransactionIds(Collection<UUID> transactionIds);

    record PendingCount(long count, Long amount) {
    }

    record MemberRow(UUID id, UUID batchId, String groupKey, String factType, String status, UUID transactionId,
                     LocalDate approvedAt, long amount) {
    }
}
