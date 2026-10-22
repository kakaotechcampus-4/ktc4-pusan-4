package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.merchant.api.ClassificationReviewStatus;
import com.ktc4.pusan4.transaction.api.CardIssuer;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.api.SourceType;
import com.ktc4.pusan4.transaction.domain.ClassificationReviewGroup;
import com.ktc4.pusan4.transaction.domain.ClassificationReviewItem;
import com.ktc4.pusan4.transaction.domain.ClassificationReviewResult;
import com.ktc4.pusan4.transaction.domain.NewTransaction;
import com.ktc4.pusan4.transaction.domain.NewUploadBatch;
import com.ktc4.pusan4.transaction.persistence.ClassificationReviewService;
import com.ktc4.pusan4.transaction.persistence.UploadService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 분류 확인 목록 (api.md 3.5, docs/backend_api_plan.md B8). 테스트마다 사용자를 새로 만든다.
 * 「성진이네 본점」「ZQXW TRADING」은 사전·키워드에 없어 미분류로 들어온다.
 */
@SpringBootTest
@Testcontainers
class ClassificationReviewIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private UploadService uploadService;

    @Autowired
    private ClassificationReviewService reviewService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void list_is_created_order_and_unresolved_ignores_status_and_page() {
        // given: 미분류 3건(하나는 이미 해결), 분류된 1건, 같은 사용자의 다른 batch, 남의 batch
        UUID userId = newUser();
        UUID batchId = upload(userId, "hash-list",
            tx("k-1", "2026-01-05", "성진이네 본점", 10_000L),
            tx("k-2", "2026-01-03", "ZQXW TRADING", 20_000L),
            tx("k-3", "2026-01-01", "성진이네 본점", 30_000L),
            tx("k-4", "2026-01-02", "스타벅스코리아 서면점", 40_000L));
        upload(userId, "hash-list-other", tx("k-5", "2026-02-01", "성진이네 본점", 50_000L));
        upload(newUser(), "hash-list-stranger", tx("k-1", "2026-01-05", "성진이네 본점", 60_000L));
        resolve(userId, "k-2");

        // when
        ClassificationReviewResult<ClassificationReviewItem> firstPage = reviewService.list(userId, batchId, null, 0, 2);

        // then: 요청은 업로드 순서, 미해소는 PENDING 2건 · 40,000원
        assertThat(firstPage.page().getTotalElements()).isEqualTo(3);
        assertThat(firstPage.page().getContent()).extracting(ClassificationReviewItem::transactionId)
            .containsExactly(idOf(userId, "k-1"), idOf(userId, "k-2"));
        assertThat(firstPage.unresolvedCount()).isEqualTo(2);
        assertThat(firstPage.unresolvedAmount()).isEqualTo(40_000L);

        ClassificationReviewResult<ClassificationReviewItem> resolved =
            reviewService.list(userId, batchId, ClassificationReviewStatus.RESOLVED, 0, 20);
        assertThat(resolved.page().getContent()).singleElement().satisfies(review -> {
            assertThat(review.transactionId()).isEqualTo(idOf(userId, "k-2"));
            assertThat(review.resolvedAt()).isNotNull();
        });
        assertThat(resolved.unresolvedCount()).isEqualTo(2);
        assertThat(resolved.unresolvedAmount()).isEqualTo(40_000L);

        ClassificationReviewResult<ClassificationReviewItem> allBatches = reviewService.list(userId, null, null, 0, 20);
        assertThat(allBatches.page().getTotalElements()).isEqualTo(4);
        assertThat(allBatches.unresolvedCount()).isEqualTo(3);
    }

    @Test
    void groups_merge_same_merchant_norm_and_page_by_group() {
        // given
        UUID userId = newUser();
        UUID batchId = upload(userId, "hash-group",
            tx("k-1", "2026-01-05", "성진이네 본점", 10_000L),
            tx("k-2", "2026-01-03", "ZQXW TRADING", 20_000L),
            tx("k-3", "2026-01-01", "성진이네 본점", 30_000L));

        // when
        ClassificationReviewResult<ClassificationReviewGroup> groups = reviewService.groups(userId, batchId, null, 0, 1);

        // then: 그룹 2개를 한 개씩 자른다. 첫 그룹의 거래는 승인일 오름차순이다
        assertThat(groups.page().getTotalElements()).isEqualTo(2);
        ClassificationReviewGroup first = groups.page().getContent().getFirst();
        assertThat(first.merchantNorm()).isEqualTo(normOf(userId, "k-1"));
        assertThat(first.groupKey()).isEqualTo("merchant:" + normOf(userId, "k-1"));
        assertThat(first.reviews()).extracting(ClassificationReviewItem::transactionId)
            .containsExactly(idOf(userId, "k-3"), idOf(userId, "k-1"));
        assertThat(first.totalAmount()).isEqualTo(40_000L);
        assertThat(groups.unresolvedCount()).isEqualTo(3);
        assertThat(groups.unresolvedAmount()).isEqualTo(60_000L);

        ClassificationReviewGroup second = reviewService.groups(userId, batchId, null, 1, 1).page().getContent().getFirst();
        assertThat(second.reviews()).extracting(ClassificationReviewItem::transactionId)
            .containsExactly(idOf(userId, "k-2"));
    }

    private void resolve(UUID userId, String naturalKey) {
        jdbcTemplate.update("""
            update classification_review
            set status = 'RESOLVED', selected_category = '기타', resolved_at = now()
            where transaction_id = ?
            """, idOf(userId, naturalKey));
    }

    private UUID idOf(UUID userId, String naturalKey) {
        return jdbcTemplate.queryForObject(
            "select id from transaction where user_id = ? and natural_key = ?", UUID.class, userId, naturalKey);
    }

    private String normOf(UUID userId, String naturalKey) {
        return jdbcTemplate.queryForObject(
            "select merchant_norm from transaction where user_id = ? and natural_key = ?", String.class,
            userId, naturalKey);
    }

    private UUID upload(UUID userId, String fileHash, NewTransaction... transactions) {
        return uploadService.upload(userId, "key-" + fileHash, new NewUploadBatch(SourceType.승인내역, CardIssuer.국민,
            LocalDate.parse("2025-01-01"), LocalDate.parse("2026-12-31"), fileHash, List.of(transactions))).id();
    }

    private UUID newUser() {
        UUID userId = UUID.randomUUID();
        jdbcTemplate.update("insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com");
        return userId;
    }

    private static NewTransaction tx(String naturalKey, String approvedAt, String merchantRaw, long amount) {
        return new NewTransaction(LocalDate.parse(approvedAt), merchantRaw, amount, naturalKey,
            SourceStatus.JUDGEABLE, 0, null, null, null, null, null, false, false, null, null);
    }
}
