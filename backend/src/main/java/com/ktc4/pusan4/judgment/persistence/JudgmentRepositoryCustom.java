package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.persistence.JudgmentRepository.LimitTagged;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

/** 판정 대상 조건(TransactionConditions)을 쓰는 판정 조회. 구현은 QueryDSL 이다. */
interface JudgmentRepositoryCustom {

    // 판정 목록 (api.md 3.7). 비어 있지 않은 조건만 건다. 범위는 셋 중 하나다.
    //  - runId: 그 Run 이 직접 만든 판정. 이후 답변·수정으로 생긴 revision 은 빠진다.
    //  - history: 모든 revision.
    //  - 현재 판정(§5): 거래가 가리키는 판정(transaction.current_judgment_id).
    //    거래를 지정하지 않으면 지금 판정 대상인 거래만 남긴다.
    // 답변 대기(awaiting)는 불가이면서 그 거래에 PENDING 질문이 남은 판정이다. 질문 목록처럼 지금 판정 대상인 거래만 본다.
    // 정렬: query.sort (기본 computedAt DESC, id DESC).
    Page<JudgmentEntity> findPage(UUID userId, JudgmentListQuery query, Pageable pageable);

    // 요약(api.md 3.7 summary)에 필요한 값만 꺼낸다. 대상은 같은 조건의 findPage 와 같다.
    // 판정 행은 input_facts 를 싣고 있어 엔티티로 읽으면 거래 수의 제곱만큼 메모리를 쓴다(아래 findCurrentLimitTagged 와 같은 이유).
    List<SummaryRow> findSummaryRows(UUID userId, JudgmentListQuery query);

    // 한도 집계(LimitSettlementService) 대상: 사용자의 현재 판정(§5) 중 가능이면서 limit_bucket 이 bucket 인 것.
    // 지금 판정 대상인 거래만 본다(findPage 와 같다). 판정 행은 batch 의 UserFact 전부(input_facts)를 싣고 있어,
    // 엔티티로 읽으면 거래 수의 제곱만큼 메모리를 쓴다. 집계에 필요한 값만 꺼낸다.
    List<LimitTagged> findCurrentLimitTagged(UUID userId, String bucket);

    /** 요약할 판정 하나. spendAmount 는 거래 결제 금액, awaiting 은 답변 대기 여부다. */
    record SummaryRow(UUID judgmentId, String verdict, String account, Long finalAmount, long spendAmount,
                      boolean awaiting) {
    }
}
