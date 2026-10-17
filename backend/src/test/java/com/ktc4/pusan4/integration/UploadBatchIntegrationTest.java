package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.transaction.api.CardIssuer;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.api.SourceType;
import com.ktc4.pusan4.transaction.domain.NewTransaction;
import com.ktc4.pusan4.transaction.domain.NewUploadBatch;
import com.ktc4.pusan4.transaction.domain.UploadBatchSummary;
import com.ktc4.pusan4.transaction.domain.UploadResult;
import com.ktc4.pusan4.transaction.persistence.UploadBatchService;
import com.ktc4.pusan4.transaction.persistence.UploadService;
import com.ktc4.pusan4.user.persistence.UserService;
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
 * 업로드 배치 조회·삭제와 탈퇴 (api.md 3.1·3.3, docs/backend_api_plan.md B6).
 * 연쇄 삭제의 표 단위 검사는 JudgmentSchemaIntegrationTest 가 SQL 로 한다. 여기서는 서비스를 거쳐 확인한다.
 * 탈퇴가 임시 사용자를 지우면 같은 컨테이너의 다른 테스트가 깨지므로 테스트마다 사용자를 새로 만든다.
 */
@SpringBootTest
@Testcontainers
class UploadBatchIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private UploadService uploadService;

    @Autowired
    private UploadBatchService batchService;

    @Autowired
    private UserService userService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void list_returns_own_batches_newest_first_with_counts() {
        // given: 첫 업로드는 미분류 1건, 두 번째는 중복 1건을 건너뛴다
        UUID userId = newUser();
        UploadResult first = upload(userId, "hash-list-1", tx("k-1", "스타벅스코리아 서면점"), tx("k-2", "성진이네 본점"));
        UploadResult second = upload(userId, "hash-list-2", tx("k-1", "스타벅스코리아 서면점"), tx("k-3", "스타벅스코리아 남포점"));
        upload(newUser(), "hash-list-other", tx("k-1", "스타벅스코리아 서면점"));

        // when
        Page<UploadBatchSummary> page = batchService.list(userId, 0, 20);

        // then
        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).extracting(UploadBatchSummary::id).containsExactly(second.id(), first.id());
        assertThat(page.getContent()).extracting(UploadBatchSummary::transactionCount,
                UploadBatchSummary::skippedDuplicateCount, UploadBatchSummary::classificationPendingCount)
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple(1, 1, 0),
                org.assertj.core.groups.Tuple.tuple(2, 0, 1));
        assertThat(page.getContent().getFirst().sourceType()).isEqualTo(SourceType.승인내역);
        assertThat(page.getContent().getFirst().createdAt()).isAtSameInstantAs(second.createdAt());
        assertThat(page.getContent().getFirst().createdAt().getOffset().getTotalSeconds()).isEqualTo(9 * 3600);
    }

    @Test
    void classification_pending_count_is_live() {
        // given
        UUID userId = newUser();
        UploadResult result = upload(userId, "hash-live", tx("k-1", "성진이네 본점"));

        // when: 사용자가 분류에 답한 상태(B8)를 SQL 로 흉내 낸다
        jdbcTemplate.update("""
            update classification_review set status = 'RESOLVED', selected_category = '음식점', resolved_at = now()
            where transaction_id in (select id from transaction where batch_id = ?)
            """, result.id());

        // then
        assertThat(batchService.get(userId, result.id()).classificationPendingCount()).isZero();
    }

    @Test
    void other_users_batch_is_not_found() {
        UUID owner = newUser();
        UUID batchId = upload(owner, "hash-other", tx("k-1", "스타벅스코리아 서면점")).id();
        UUID stranger = newUser();

        assertThatThrownBy(() -> batchService.get(stranger, batchId))
            .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("BATCH_NOT_FOUND"));
        assertThatThrownBy(() -> batchService.delete(stranger, batchId))
            .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("BATCH_NOT_FOUND"));
        assertThat(batchService.get(owner, batchId).id()).isEqualTo(batchId);
    }

    @Test
    void delete_removes_batch_and_derived_data_but_keeps_other_batches_and_idempotency_key() {
        // given: 판정·질문·답변·수정까지 붙은 batch 와, 같은 사용자의 다른 batch
        UUID userId = newUser();
        UUID contextId = newContext(userId);
        UUID target = upload(userId, "hash-delete", tx("k-1", "스타벅스코리아 서면점"), tx("k-2", "성진이네 본점")).id();
        UUID kept = upload(userId, "hash-keep", tx("k-3", "스타벅스코리아 남포점")).id();
        addJudgedGraph(userId, target, contextId);

        // when
        batchService.delete(userId, target);

        // then
        assertThat(count("select count(*) from upload_batch where id = ?", target)).isZero();
        assertThat(count("select count(*) from transaction where batch_id = ?", target)).isZero();
        assertThat(count("select count(*) from judgment_run where batch_id = ?", target)).isZero();
        assertThat(count("select count(*) from user_fact where batch_id = ?", target)).isZero();
        assertThat(count("select count(*) from judgment j join transaction t on t.id = j.transaction_id "
            + "where t.user_id = ?", userId)).isZero();
        assertThat(count("select count(*) from classification_review r join transaction t on t.id = r.transaction_id "
            + "where t.batch_id = ?", target)).isZero();
        assertThat(batchService.get(userId, kept).transactionCount()).isEqualTo(1);
        // 키는 남고 batch 만 비어서, 같은 키로 다시 보내면 410 이 된다(B5)
        assertThat(jdbcTemplate.queryForList(
            "select batch_id from idempotency_key where user_id = ? and idempotency_key = ?", UUID.class,
            userId, "key-hash-delete")).containsExactly((UUID) null);
        assertThatThrownBy(() -> batchService.get(userId, target)).isInstanceOf(ApiException.class);
    }

    @Test
    void deleting_user_removes_owned_data_and_second_delete_is_unauthorized() {
        // given
        UUID userId = newUser();
        UUID contextId = newContext(userId);
        UUID batchId = upload(userId, "hash-user", tx("k-1", "스타벅스코리아 서면점")).id();
        addJudgedGraph(userId, batchId, contextId);
        UUID otherUser = newUser();
        upload(otherUser, "hash-user-other", tx("k-1", "스타벅스코리아 서면점"));

        // when
        userService.delete(userId);

        // then
        assertThat(count("select count(*) from app_user where id = ?", userId)).isZero();
        assertThat(count("select count(*) from upload_batch where user_id = ?", userId)).isZero();
        assertThat(count("select count(*) from user_context where user_id = ?", userId)).isZero();
        assertThat(count("select count(*) from user_fact where user_id = ?", userId)).isZero();
        assertThat(count("select count(*) from idempotency_key where user_id = ?", userId)).isZero();
        assertThat(count("select count(*) from upload_batch where user_id = ?", otherUser)).isEqualTo(1);
        assertThatThrownBy(() -> userService.delete(userId))
            .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("UNAUTHORIZED"));
    }

    /** batch 의 첫 거래에 run → 판정 → 질문(답변) → override 를 붙인다. 판정 실행기 대신 SQL 로 넣는다. */
    private void addJudgedGraph(UUID userId, UUID batchId, UUID contextId) {
        UUID transactionId = jdbcTemplate.queryForObject(
            "select id from transaction where batch_id = ? order by natural_key limit 1", UUID.class, batchId);
        UUID runId = UUID.randomUUID();
        UUID judgmentId = UUID.randomUUID();
        UUID factId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment_run(id, batch_id, context_id, context_version, status, total_count)
            values (?, ?, ?, 1, 'COMPLETED', 1)
            """, runId, batchId, contextId);
        jdbcTemplate.update("""
            insert into judgment_run_item(run_id, transaction_id, status, processed_at)
            values (?, ?, 'SUCCEEDED', now())
            """, runId, transactionId);
        jdbcTemplate.update("""
            insert into judgment(
                id, transaction_id, revision, rules_commit_sha, user_context_version,
                tax_year, verdict, is_inference, run_id
            ) values (?, ?, 1, 'fixture', 1, 2026, 'NEEDS_REVIEW', false, ?)
            """, judgmentId, transactionId, runId);
        jdbcTemplate.update("""
            insert into user_fact(id, user_id, batch_id, scope_key, fact_type, value, version)
            values (?, ?, ?, 'merchant:스타벅스', '용도', '{"value": "업무"}', 1)
            """, factId, userId, batchId);
        jdbcTemplate.update("""
            insert into question_queue(
                judgment_id, id, reason_code, question_text, group_key, fact_type,
                status, answered_fact_id, answered_at
            ) values (?, ?, 'PURPOSE', '용도는 무엇인가요?', 'merchant:스타벅스', '용도', 'ANSWERED', ?, now())
            """, judgmentId, UUID.randomUUID(), factId);
        jdbcTemplate.update("""
            insert into judgment_override(id, transaction_id, source_judgment_id, to_verdict, active)
            values (?, ?, ?, 'AVAILABLE', true)
            """, UUID.randomUUID(), transactionId, judgmentId);
    }

    private long count(String sql, Object... args) {
        return jdbcTemplate.queryForObject(sql, Long.class, args);
    }

    private UploadResult upload(UUID userId, String fileHash, NewTransaction... transactions) {
        return uploadService.upload(userId, "key-" + fileHash, new NewUploadBatch(SourceType.승인내역, CardIssuer.국민,
            LocalDate.parse("2026-01-01"), LocalDate.parse("2026-01-31"), fileHash, List.of(transactions)));
    }

    private UUID newUser() {
        UUID userId = UUID.randomUUID();
        jdbcTemplate.update("insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com");
        return userId;
    }

    private UUID newContext(UUID userId) {
        UUID contextId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into user_context(
                id, user_id, industry_code, prev_year_revenue, business_open_date,
                bookkeeping_duty, has_employee, version
            ) values (?, ?, '940909', 0, '2024-01-01', '간편장부', false, 1)
            """, contextId, userId);
        return contextId;
    }

    private static NewTransaction tx(String naturalKey, String merchantRaw) {
        return new NewTransaction(LocalDate.parse("2026-01-03"), merchantRaw, 11_000L, naturalKey,
            SourceStatus.JUDGEABLE, 0, null, null, null, null, null, false, false, null, null);
    }
}
