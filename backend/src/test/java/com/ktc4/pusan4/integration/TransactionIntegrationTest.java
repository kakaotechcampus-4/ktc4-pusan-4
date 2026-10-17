package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.transaction.api.CardIssuer;
import com.ktc4.pusan4.transaction.api.ClassificationStatus;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.api.SourceType;
import com.ktc4.pusan4.transaction.api.UserInclusion;
import com.ktc4.pusan4.transaction.domain.NewTransaction;
import com.ktc4.pusan4.transaction.domain.NewUploadBatch;
import com.ktc4.pusan4.transaction.domain.TransactionDetail;
import com.ktc4.pusan4.transaction.domain.TransactionFilter;
import com.ktc4.pusan4.transaction.persistence.TransactionService;
import com.ktc4.pusan4.transaction.persistence.UploadService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.domain.Page;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 거래 조회와 포함·제외 (api.md 3.4, docs/backend_api_plan.md B7). 테스트마다 사용자를 새로 만든다.
 */
@SpringBootTest
@Testcontainers
class TransactionIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final TransactionFilter ALL = new TransactionFilter(null, null, null, null, null, null);

    @Autowired
    private UploadService uploadService;

    @Autowired
    private TransactionService transactionService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void list_is_newest_first_and_only_own_transactions() {
        // given
        UUID userId = newUser();
        UUID batchId = upload(userId, "hash-order",
            tx("k-1", "2026-01-03", "스타벅스코리아 서면점", SourceStatus.JUDGEABLE),
            tx("k-2", "2026-02-10", "스타벅스코리아 남포점", SourceStatus.JUDGEABLE),
            tx("k-3", "2025-12-31", "성진이네 본점", SourceStatus.JUDGEABLE));
        upload(newUser(), "hash-order-other", tx("k-1", "2026-03-01", "스타벅스코리아 서면점", SourceStatus.JUDGEABLE));

        // when
        Page<TransactionDetail> page = transactionService.list(userId, ALL, 0, 2);

        // then
        assertThat(page.getTotalElements()).isEqualTo(3);
        assertThat(page.getContent()).extracting(TransactionDetail::approvedAt)
            .containsExactly(LocalDate.parse("2026-02-10"), LocalDate.parse("2026-01-03"));
        assertThat(transactionService.list(userId, ALL, 1, 2).getContent()).extracting(TransactionDetail::batchId)
            .containsExactly(batchId);
    }

    @Test
    void filters_by_year_month_classification_and_effective_status() {
        // given: 판정대상 2(하나는 미분류), 파서 제외 1, 취소상계 1
        UUID userId = newUser();
        upload(userId, "hash-filter",
            tx("k-1", "2026-01-03", "스타벅스코리아 서면점", SourceStatus.JUDGEABLE),
            tx("k-2", "2025-01-20", "성진이네 본점", SourceStatus.JUDGEABLE),
            tx("k-3", "2026-02-01", "스타벅스코리아 남포점", SourceStatus.EXCLUDED),
            tx("k-4", "2026-01-05", "스타벅스코리아 광안점", SourceStatus.CANCELED_OFFSET));
        UUID excludedByUser = idOf(userId, "k-1");
        UUID includedByUser = idOf(userId, "k-3");
        transactionService.exclude(userId, excludedByUser);
        transactionService.include(userId, includedByUser);

        // then
        assertThat(keys(userId, new TransactionFilter(null, 2026, null, null, null, null)))
            .containsExactly("k-3", "k-4", "k-1");
        assertThat(keys(userId, new TransactionFilter(null, null, 1, null, null, null)))
            .containsExactly("k-4", "k-1", "k-2");
        assertThat(keys(userId, new TransactionFilter(null, 2026, 1, null, null, null)))
            .containsExactly("k-4", "k-1");
        assertThat(keys(userId, new TransactionFilter(null, null, null, null, ClassificationStatus.NEEDS_REVIEW, null)))
            .containsExactly("k-2");
        assertThat(keys(userId, new TransactionFilter(null, null, null, SourceStatus.JUDGEABLE, null, null)))
            .containsExactly("k-3", "k-2");
        assertThat(keys(userId, new TransactionFilter(null, null, null, SourceStatus.EXCLUDED, null, null)))
            .containsExactly("k-1");
        assertThat(keys(userId, new TransactionFilter(null, null, null, SourceStatus.CANCELED_OFFSET, null, null)))
            .containsExactly("k-4");
    }

    @Test
    void verdict_filter_uses_current_judgment() {
        // given
        UUID userId = newUser();
        UUID batchId = upload(userId, "hash-verdict",
            tx("k-1", "2026-01-03", "스타벅스코리아 서면점", SourceStatus.JUDGEABLE),
            tx("k-2", "2026-01-04", "스타벅스코리아 남포점", SourceStatus.JUDGEABLE),
            tx("k-3", "2026-01-05", "스타벅스코리아 광안점", SourceStatus.JUDGEABLE));
        UUID runId = newRun(userId, batchId);
        // k-1: 확인 필요 → 답변 후 가능. 최신 자동 판정이 현재다
        judgment(idOf(userId, "k-1"), 1, "NEEDS_REVIEW", "run_id", runId);
        judgment(idOf(userId, "k-1"), 2, "AVAILABLE", "run_id", runId);
        // k-2: 자동 판정은 가능인데 사용자가 불가로 수정했다. 활성 override 가 현재다
        UUID source = judgment(idOf(userId, "k-2"), 1, "AVAILABLE", "run_id", runId);
        UUID overrideId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment_override(id, transaction_id, source_judgment_id, to_verdict, active)
            values (?, ?, ?, 'UNAVAILABLE', true)
            """, overrideId, idOf(userId, "k-2"), source);
        judgment(idOf(userId, "k-2"), 2, "UNAVAILABLE", "judgment_override_id", overrideId);
        // k-3: 판정이 없다

        // then
        assertThat(keys(userId, new TransactionFilter(null, null, null, null, null, Verdict.AVAILABLE)))
            .containsExactly("k-1");
        assertThat(keys(userId, new TransactionFilter(null, null, null, null, null, Verdict.UNAVAILABLE)))
            .containsExactly("k-2");
        assertThat(keys(userId, new TransactionFilter(null, null, null, null, null, Verdict.NEEDS_REVIEW))).isEmpty();
    }

    @Test
    void exclude_and_include_change_effective_status_and_keep_judgments() {
        // given
        UUID userId = newUser();
        UUID batchId = upload(userId, "hash-toggle", tx("k-1", "2026-01-03", "스타벅스코리아 서면점", SourceStatus.JUDGEABLE));
        UUID transactionId = idOf(userId, "k-1");
        judgment(transactionId, 1, "AVAILABLE", "run_id", newRun(userId, batchId));

        // when / then
        TransactionDetail excluded = transactionService.exclude(userId, transactionId);
        assertThat(excluded.userInclusion()).isEqualTo(UserInclusion.EXCLUDED);
        assertThat(excluded.effectiveStatus()).isEqualTo(SourceStatus.EXCLUDED);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from judgment where transaction_id = ?", Long.class, transactionId)).isEqualTo(1L);

        TransactionDetail included = transactionService.include(userId, transactionId);
        assertThat(included.userInclusion()).isEqualTo(UserInclusion.INCLUDED);
        assertThat(included.effectiveStatus()).isEqualTo(SourceStatus.JUDGEABLE);
        assertThat(transactionService.get(userId, transactionId).userInclusion()).isEqualTo(UserInclusion.INCLUDED);
    }

    @Test
    void including_unclassified_excluded_transaction_creates_one_classification_review() {
        // given: 업로드는 파서 제외 거래의 분류 검토를 만들지 않는다(B4)
        UUID userId = newUser();
        upload(userId, "hash-review", tx("k-1", "2026-01-03", "성진이네 본점", SourceStatus.EXCLUDED));
        UUID transactionId = idOf(userId, "k-1");
        assertThat(pendingReviews(transactionId)).isZero();

        // when: 포함을 두 번 눌러도
        transactionService.include(userId, transactionId);
        transactionService.include(userId, transactionId);

        // then
        assertThat(pendingReviews(transactionId)).isEqualTo(1L);
    }

    @Test
    void canceled_offset_cannot_be_included_and_others_transactions_are_not_found() {
        UUID userId = newUser();
        upload(userId, "hash-canceled", tx("k-1", "2026-01-03", "스타벅스코리아 서면점", SourceStatus.CANCELED_OFFSET));
        UUID transactionId = idOf(userId, "k-1");
        UUID stranger = newUser();

        assertThatThrownBy(() -> transactionService.include(userId, transactionId))
            .isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getCode()).isEqualTo("CANCELED_TRANSACTION_NOT_INCLUDABLE"));
        assertThat(transactionService.get(userId, transactionId).userInclusion()).isEqualTo(UserInclusion.AUTO);
        assertThatThrownBy(() -> transactionService.get(stranger, transactionId))
            .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("TRANSACTION_NOT_FOUND"));
        assertThatThrownBy(() -> transactionService.exclude(stranger, transactionId))
            .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("TRANSACTION_NOT_FOUND"));
    }

    private List<String> keys(UUID userId, TransactionFilter filter) {
        return transactionService.list(userId, filter, 0, 100).getContent().stream()
            .map(transaction -> jdbcTemplate.queryForObject(
                "select natural_key from transaction where id = ?", String.class, transaction.id()))
            .toList();
    }

    private UUID idOf(UUID userId, String naturalKey) {
        return jdbcTemplate.queryForObject(
            "select id from transaction where user_id = ? and natural_key = ?", UUID.class, userId, naturalKey);
    }

    private long pendingReviews(UUID transactionId) {
        return jdbcTemplate.queryForObject(
            "select count(*) from classification_review where transaction_id = ? and status = 'PENDING'",
            Long.class, transactionId);
    }

    private UUID newRun(UUID userId, UUID batchId) {
        UUID contextId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into user_context(
                id, user_id, industry_code, prev_year_revenue, business_open_date,
                bookkeeping_duty, has_employee, version
            ) values (?, ?, '940909', 0, '2024-01-01', '간편장부', false, 1)
            """, contextId, userId);
        UUID runId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment_run(id, batch_id, context_id, context_version, status, total_count)
            values (?, ?, ?, 1, 'COMPLETED', 1)
            """, runId, batchId, contextId);
        return runId;
    }

    private UUID judgment(UUID transactionId, int revision, String verdict, String originColumn, UUID originId) {
        UUID judgmentId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment(
                id, transaction_id, revision, rules_commit_sha, user_context_version,
                tax_year, verdict, is_inference, %s
            ) values (?, ?, ?, 'fixture', 1, 2026, ?, false, ?)
            """.formatted(originColumn), judgmentId, transactionId, revision, verdict, originId);
        return judgmentId;
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

    private static NewTransaction tx(String naturalKey, String approvedAt, String merchantRaw, SourceStatus status) {
        return new NewTransaction(LocalDate.parse(approvedAt), merchantRaw, 11_000L, naturalKey,
            status, 0, null, null, null, null, null, false, false, null, null);
    }
}
