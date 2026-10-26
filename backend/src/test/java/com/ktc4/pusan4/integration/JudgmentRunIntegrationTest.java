package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.judgment.domain.JudgmentRun;
import com.ktc4.pusan4.judgment.domain.JudgmentRunFailure;
import com.ktc4.pusan4.judgment.domain.JudgmentRunStatus;
import com.ktc4.pusan4.judgment.persistence.JudgmentRunService;
import com.ktc4.pusan4.shared.api.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 판정 실행: 대상 고정 → 커밋 뒤 비동기 실행 → 폴링 (api.md 3.6). 실제 규칙 카드(../rules)로 돈다.
 * 카페는 R-300 으로 성공한다. 도서(R-940909202)는 §27① 을 인용하는데 그 조문을 넣지 않아 기술적으로 실패한다.
 */
@SpringBootTest
@Testcontainers
class JudgmentRunIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final Set<JudgmentRunStatus> FINISHED = Set.of(
        JudgmentRunStatus.COMPLETED, JudgmentRunStatus.PARTIAL_FAILED, JudgmentRunStatus.FAILED
    );

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JudgmentRunService runService;

    private UUID userId;
    private UUID batchId;
    private UUID contextId;

    @BeforeEach
    void setUp() {
        userId = insertUser();
        batchId = insertBatch(userId);
        contextId = insertContext(userId);
        for (String statuteId : List.of("소득세법-33-1-5", "소득세법시행령-61-1-1", "소득세법-35-1")) {
            jdbcTemplate.update("""
                insert into statute_version(
                    statute_id, doc_type, hierarchy, effective_from, body, body_hash,
                    doc_id, unit_level, title, source_url
                ) values (?, '법령', '법률', '2024-01-01', '원문', 'hash', 'DOC', '호', ?, 'https://law.go.kr/test')
                on conflict do nothing
                """, statuteId, statuteId);
        }
    }

    @Test
    void run_targets_only_judgeable_classified_transactions_and_records_failures() {
        UUID cafe = insertTransaction("카페", "JUDGEABLE", "AUTO", "CLASSIFIED");
        UUID includedByUser = insertTransaction("카페", "EXCLUDED", "INCLUDED", "CLASSIFIED");
        UUID book = insertTransaction("도서", "JUDGEABLE", "AUTO", "CLASSIFIED");
        insertTransaction("카페", "JUDGEABLE", "EXCLUDED", "CLASSIFIED");
        insertTransaction("카페", "EXCLUDED", "AUTO", "CLASSIFIED");
        insertTransaction("카페", "CANCELED_OFFSET", "AUTO", "CLASSIFIED");
        insertTransaction("미분류", "JUDGEABLE", "AUTO", "NEEDS_REVIEW");

        JudgmentRun created = runService.create(userId, batchId, contextId);
        JudgmentRun finished = awaitFinished(created.id());

        assertThat(created.status()).isEqualTo(JudgmentRunStatus.QUEUED);
        assertThat(created.totalCount()).isEqualTo(3);
        assertThat(created.contextVersion()).isEqualTo(1);
        assertThat(finished.status()).isEqualTo(JudgmentRunStatus.PARTIAL_FAILED);
        assertThat(finished.processedCount()).isEqualTo(2);
        assertThat(finished.failedCount()).isEqualTo(1);
        assertThat(finished.startedAt()).isNotNull();
        assertThat(finished.completedAt()).isNotNull();
        assertThat(jdbcTemplate.queryForList(
            "select transaction_id from judgment where run_id = ?", UUID.class, created.id()
        )).containsExactlyInAnyOrder(cafe, includedByUser);

        List<JudgmentRunFailure> failures = runService.failures(userId, created.id(), 0, 20).getContent();
        assertThat(failures).singleElement().satisfies(failure -> {
            assertThat(failure.transactionId()).isEqualTo(book);
            assertThat(failure.errorCode()).isEqualTo("RULE_PROCESSING_FAILED");
            assertThat(failure.message()).isEqualTo("판정 처리 중 오류가 발생했습니다.");
            assertThat(failure.failedAt()).isNotNull();
        });
    }

    @Test
    void run_without_failures_completes() {
        insertTransaction("카페", "JUDGEABLE", "AUTO", "CLASSIFIED");

        JudgmentRun finished = awaitFinished(runService.create(userId, batchId, contextId).id());

        assertThat(finished.status()).isEqualTo(JudgmentRunStatus.COMPLETED);
        assertThat(finished.processedCount()).isEqualTo(1);
        assertThat(finished.failedCount()).isZero();
    }

    @Test
    void run_with_no_targets_completes_with_zero_counts() {
        JudgmentRun finished = awaitFinished(runService.create(userId, batchId, contextId).id());

        assertThat(finished.status()).isEqualTo(JudgmentRunStatus.COMPLETED);
        assertThat(finished.totalCount()).isZero();
    }

    @Test
    void run_with_only_failures_fails() {
        insertTransaction("도서", "JUDGEABLE", "AUTO", "CLASSIFIED");

        JudgmentRun finished = awaitFinished(runService.create(userId, batchId, contextId).id());

        assertThat(finished.status()).isEqualTo(JudgmentRunStatus.FAILED);
        assertThat(finished.failedCount()).isEqualTo(1);
    }

    @Test
    void another_users_batch_context_and_run_are_not_found() {
        UUID otherUserId = insertUser();
        UUID otherBatchId = insertBatch(otherUserId);
        UUID otherContextId = insertContext(otherUserId);
        UUID runId = runService.create(userId, batchId, contextId).id();

        assertThatThrownBy(() -> runService.create(userId, otherBatchId, contextId))
            .isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getCode()).isEqualTo("BATCH_NOT_FOUND"));
        assertThatThrownBy(() -> runService.create(userId, batchId, otherContextId))
            .isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getCode()).isEqualTo("CONTEXT_NOT_FOUND"));
        assertThatThrownBy(() -> runService.get(otherUserId, runId))
            .isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getCode()).isEqualTo("JUDGMENT_RUN_NOT_FOUND"));
        assertThatThrownBy(() -> runService.failures(otherUserId, runId, 0, 20))
            .isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getCode()).isEqualTo("JUDGMENT_RUN_NOT_FOUND"));
    }

    private JudgmentRun awaitFinished(UUID runId) {
        Instant deadline = Instant.now().plus(Duration.ofSeconds(15));
        while (Instant.now().isBefore(deadline)) {
            JudgmentRun run = runService.get(userId, runId);
            if (FINISHED.contains(run.status())) {
                return run;
            }
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(e);
            }
        }
        throw new AssertionError("run " + runId + " did not finish in time");
    }

    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("insert into app_user(id, email) values (?, ?)", id, id + "@example.com");
        return id;
    }

    private UUID insertBatch(UUID ownerId) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into upload_batch(id, user_id, source_type, card_issuer, period_start, period_end, file_hash)
            values (?, ?, '승인내역', '국민', '2025-01-01', '2025-12-31', ?)
            """, id, ownerId, id.toString());
        return id;
    }

    private UUID insertContext(UUID ownerId) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into user_context(
                id, user_id, industry_code, prev_year_revenue, business_open_date,
                bookkeeping_duty, has_employee, version
            ) values (?, ?, '940909', 30000000, '2023-01-01', '간편장부', false, 1)
            """, id, ownerId);
        return id;
    }

    private UUID insertTransaction(
        String category, String sourceStatus, String userInclusion, String classificationStatus
    ) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, '2025-10-08', '가맹점', '가맹점', ?, 6500, ?, ?, ?, ?)
            """, id, batchId, userId, category, id.toString(), sourceStatus, userInclusion, classificationStatus);
        return id;
    }
}
