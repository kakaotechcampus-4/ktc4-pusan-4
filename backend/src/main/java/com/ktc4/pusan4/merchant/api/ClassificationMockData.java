package com.ktc4.pusan4.merchant.api;

import com.ktc4.pusan4.shared.api.Coded;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.List;

import static com.ktc4.pusan4.shared.api.MockFixtures.BATCH_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.REVIEW_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.UNCLASSIFIED_TRANSACTION_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.singlePage;

/**
 * 서비스 레이어가 붙기 전까지 classification API 가 반환하는 고정 응답.
 */
@Component
public class ClassificationMockData {

    private static final List<String> SUGGESTED_CATEGORIES = List.of("해외SaaS", "구독서비스", "기타");

    public ClassificationReviewPage reviews() {
        ClassificationReviewResponse review = new ClassificationReviewResponse(REVIEW_ID, BATCH_ID,
            UNCLASSIFIED_TRANSACTION_ID, "ELEVENLABS IO", "미확인 가맹점",
            new Coded<>(ClassificationReviewStatus.PENDING, "대기"), SUGGESTED_CATEGORIES,
            OffsetDateTime.parse("2026-09-12T13:59:00+09:00"), null);
        return new ClassificationReviewPage(List.of(review), singlePage(1));
    }

    public ClassificationReviewGroupPage reviewGroups() {
        ClassificationReviewGroupResponse group = new ClassificationReviewGroupResponse(
            "merchant:미확인 가맹점", List.of(REVIEW_ID), 1, 33_000L, "ELEVENLABS IO", SUGGESTED_CATEGORIES);
        return new ClassificationReviewGroupPage(List.of(group), singlePage(1));
    }

    public ClassificationAnswerResponse answer() {
        return new ClassificationAnswerResponse(1, "해외SaaS", 1);
    }
}
