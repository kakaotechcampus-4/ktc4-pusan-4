package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.transaction.api.CardIssuer;
import com.ktc4.pusan4.transaction.api.ClassificationStatus;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.api.SourceType;
import com.ktc4.pusan4.transaction.domain.ClassificationAnswer;
import com.ktc4.pusan4.transaction.domain.NewTransaction;
import com.ktc4.pusan4.transaction.domain.NewUploadBatch;
import com.ktc4.pusan4.transaction.domain.TransactionDetail;
import com.ktc4.pusan4.transaction.persistence.ClassificationReviewService;
import com.ktc4.pusan4.transaction.persistence.TransactionService;
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
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 분류 응답 (api.md 3.5, docs/backend_api_plan.md B8). 테스트마다 사용자를 새로 만든다.
 * 「성진이네 본점」「ZQXW TRADING」은 사전·키워드에 없어 미분류로 들어온다.
 */
@SpringBootTest
@Testcontainers
class ClassificationResponseIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private UploadService uploadService;

    @Autowired
    private ClassificationReviewService reviewService;

    @Autowired
    private TransactionService transactionService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void without_completed_run_classifies_only_and_saves_personal_dictionary() {
        // given
        UUID userId = newUser();
        UUID batchId = upload(userId, "hash-no-run",
            tx("k-1", "2026-01-05", "성진이네 본점"),
            tx("k-2", "2026-01-06", "성진이네 본점"));
        newRun(userId, batchId, "62010", 1, "RUNNING");

        // when
        ClassificationAnswer answer = reviewService.answer(userId, reviewIdsOf(userId, "k-1", "k-2"), "카페");

        // then: 완료된 run 이 없어 분류만 확정한다
        assertThat(answer).isEqualTo(new ClassificationAnswer(2, "카페", 0));
        TransactionDetail transaction = transactionService.get(userId, idOf(userId, "k-1"));
        assertThat(transaction.merchantCategory()).isEqualTo("카페");
        assertThat(transaction.classificationStatus()).isEqualTo(ClassificationStatus.CLASSIFIED);
        assertThat(jdbcTemplate.queryForObject("""
            select count(*) from classification_review r join transaction t on t.id = r.transaction_id
            where t.batch_id = ? and r.status = 'RESOLVED' and r.selected_category = '카페' and r.resolved_at is not null
            """, Long.class, batchId)).isEqualTo(2L);
        assertThat(judgmentCount(idOf(userId, "k-1"))).isZero();
        Map<String, Object> dictionary = jdbcTemplate.queryForMap(
            "select pattern, merchant_norm, merchant_category, source from merchant_dict where user_id = ?", userId);
        assertThat(dictionary).containsEntry("pattern", normOf(userId, "k-1"))
            .containsEntry("merchant_norm", normOf(userId, "k-1"))
            .containsEntry("merchant_category", "카페")
            .containsEntry("source", "user");

        // 같은 가맹점을 다시 올리면 개인 사전으로 분류된다
        upload(userId, "hash-no-run-next", tx("k-3", "2026-02-01", "성진이네 본점"));
        assertThat(transactionService.get(userId, idOf(userId, "k-3")).classificationStatus())
            .isEqualTo(ClassificationStatus.CLASSIFIED);
    }

    @Test
    void with_completed_run_rejudges_resolved_judgeable_transactions_with_that_runs_context() {
        // given: 완료 run(문진 v1) 뒤에 아직 도는 run(v2). 판정 대상 1건과 사용자가 제외한 1건
        UUID userId = newUser();
        UUID batchId = upload(userId, "hash-run",
            tx("k-1", "2026-01-05", "성진이네 본점"),
            tx("k-2", "2026-01-06", "성진이네 본점"));
        newRun(userId, batchId, "62010", 1, "COMPLETED");
        newRun(userId, batchId, "62010", 2, "RUNNING");
        transactionService.exclude(userId, idOf(userId, "k-2"));
        List<UUID> reviewIds = reviewIdsOf(userId, "k-1", "k-2");

        // when
        ClassificationAnswer answer = reviewService.answer(userId, reviewIds, "카페");

        // then: 판정 대상만, 완료 run 의 문진 버전으로, origin 은 그 거래의 분류 확인 요청이다
        assertThat(answer).isEqualTo(new ClassificationAnswer(2, "카페", 1));
        Map<String, Object> judgment = jdbcTemplate.queryForMap(
            "select classification_review_id, user_context_version from judgment where transaction_id = ?",
            idOf(userId, "k-1"));
        assertThat(judgment).containsEntry("classification_review_id", reviewIds.getFirst())
            .containsEntry("user_context_version", 1);
        assertThat(judgmentCount(idOf(userId, "k-2"))).isZero();
    }

    @Test
    void rejects_unclassified_and_unknown_categories() {
        UUID userId = newUser();
        upload(userId, "hash-category", tx("k-1", "2026-01-05", "성진이네 본점"));
        List<UUID> reviewIds = reviewIdsOf(userId, "k-1");

        assertCode(() -> reviewService.answer(userId, reviewIds, "미분류"), "UNCLASSIFIED_CATEGORY_NOT_ALLOWED");
        assertCode(() -> reviewService.answer(userId, reviewIds, "없는카테고리"), "INVALID_MERCHANT_CATEGORY");
        assertThat(pendingReviews(userId)).isEqualTo(1L);
    }

    @Test
    void unknown_or_others_reviews_are_not_found_and_nothing_changes() {
        UUID userId = newUser();
        upload(userId, "hash-owner", tx("k-1", "2026-01-05", "성진이네 본점"));
        UUID stranger = newUser();
        upload(stranger, "hash-owner-stranger", tx("k-1", "2026-01-05", "ZQXW TRADING"));

        assertCode(() -> reviewService.answer(userId, List.of(reviewIdsOf(userId, "k-1").getFirst(), UUID.randomUUID()),
            "카페"), "CLASSIFICATION_REVIEW_NOT_FOUND");
        assertCode(() -> reviewService.answer(userId, reviewIdsOf(stranger, "k-1"), "카페"),
            "CLASSIFICATION_REVIEW_NOT_FOUND");
        assertThat(pendingReviews(userId)).isEqualTo(1L);
        assertThat(pendingReviews(stranger)).isEqualTo(1L);
    }

    @Test
    void rejects_reviews_from_different_batches_and_already_resolved_reviews() {
        // given
        UUID userId = newUser();
        upload(userId, "hash-batch-a", tx("k-1", "2026-01-05", "성진이네 본점"));
        upload(userId, "hash-batch-b", tx("k-2", "2026-02-05", "ZQXW TRADING"));
        upload(userId, "hash-batch-c", tx("k-3", "2026-03-05", "성진이네 본점"), tx("k-4", "2026-03-06", "ZQXW TRADING"));

        // then
        assertCode(() -> reviewService.answer(userId, reviewIdsOf(userId, "k-1", "k-2"), "카페"),
            "REVIEWS_FROM_DIFFERENT_BATCHES");
        reviewService.answer(userId, reviewIdsOf(userId, "k-3"), "카페");
        assertCode(() -> reviewService.answer(userId, reviewIdsOf(userId, "k-3", "k-4"), "카페"),
            "CLASSIFICATION_ALREADY_RESOLVED");
        assertThat(transactionService.get(userId, idOf(userId, "k-4")).classificationStatus())
            .isEqualTo(ClassificationStatus.NEEDS_REVIEW);
    }

    private static void assertCode(Runnable call, String code) {
        assertThatThrownBy(call::run)
            .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo(code));
    }

    private List<UUID> reviewIdsOf(UUID userId, String... naturalKeys) {
        return Arrays.stream(naturalKeys)
            .map(naturalKey -> jdbcTemplate.queryForObject(
                "select id from classification_review where transaction_id = ?", UUID.class, idOf(userId, naturalKey)))
            .toList();
    }

    private long pendingReviews(UUID userId) {
        return jdbcTemplate.queryForObject("""
            select count(*) from classification_review r join transaction t on t.id = r.transaction_id
            where t.user_id = ? and r.status = 'PENDING'
            """, Long.class, userId);
    }

    private long judgmentCount(UUID transactionId) {
        return jdbcTemplate.queryForObject(
            "select count(*) from judgment where transaction_id = ?", Long.class, transactionId);
    }

    private void newRun(UUID userId, UUID batchId, String industryCode, int version, String status) {
        UUID contextId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into user_context(
                id, user_id, industry_code, prev_year_revenue, business_open_date,
                bookkeeping_duty, has_employee, version
            ) values (?, ?, ?, 0, '2024-01-01', '간편장부', false, ?)
            """, contextId, userId, industryCode, version);
        jdbcTemplate.update("""
            insert into judgment_run(id, batch_id, context_id, context_version, status, total_count)
            values (?, ?, ?, ?, ?, 1)
            """, UUID.randomUUID(), batchId, contextId, version, status);
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

    private static NewTransaction tx(String naturalKey, String approvedAt, String merchantRaw) {
        return new NewTransaction(LocalDate.parse(approvedAt), merchantRaw, 11_000L, naturalKey,
            SourceStatus.JUDGEABLE, 0, null, null, null, null, null, false, false, null, null);
    }
}
