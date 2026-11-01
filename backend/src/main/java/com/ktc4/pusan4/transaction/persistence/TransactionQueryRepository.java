package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.judgment.persistence.TransactionRecordEntity;
import com.ktc4.pusan4.transaction.domain.TransactionFilter;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

/**
 * 거래 목록 조회 (api.md 3.4). 조건이 여섯 개이고 대부분 비어서 오므로 구현은 주어진 조건만 붙인 SQL 을 만든다.
 */
interface TransactionQueryRepository {

    /** 정렬: approvedAt DESC, id DESC. 남의 거래는 섞이지 않는다. */
    Page<TransactionRecordEntity> findPage(UUID userId, TransactionFilter filter, Pageable pageable);
}
