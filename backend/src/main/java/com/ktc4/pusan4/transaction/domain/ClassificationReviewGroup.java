package com.ktc4.pusan4.transaction.domain;

import java.util.List;

/**
 * 같은 merchantNorm 의 분류 확인 요청 묶음 (api.md 3.5 grouped=true).
 * 분류 응답이 개인 사전에 merchantNorm 을 pattern 으로 남기므로, 한 번 답하면 같이 풀릴 것끼리 묶는다.
 *
 * @param reviews 정렬: approvedAt ASC, transactionId ASC
 */
public record ClassificationReviewGroup(String groupKey, String merchantNorm, List<ClassificationReviewItem> reviews) {

    public long totalAmount() {
        return reviews.stream().mapToLong(ClassificationReviewItem::amount).sum();
    }
}
