package com.ktc4.pusan4.transaction.domain;

import org.springframework.data.domain.Page;

/**
 * 분류 확인 목록 한 페이지와 미해소 집계 (api.md 3.5).
 *
 * @param unresolvedCount  PENDING Review 수. batchId 만 적용하고 status·grouped·page·size 는 적용하지 않는다
 * @param unresolvedAmount PENDING Review 가 참조하는 거래 금액 합계(원)
 */
public record ClassificationReviewResult<T>(Page<T> page, int unresolvedCount, long unresolvedAmount) {
}
