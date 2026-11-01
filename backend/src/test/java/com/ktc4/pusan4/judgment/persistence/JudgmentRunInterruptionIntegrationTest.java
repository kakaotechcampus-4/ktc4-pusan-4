package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.user.domain.BusinessContext;
import com.ktc4.pusan4.user.persistence.BusinessContextService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 서버가 내려가 멈춘 run 을 정리한다. 진행이 5분 넘게 없는 QUEUED·RUNNING run 의 남은 항목을 RUN_INTERRUPTED 로 끝낸다.
 * run 은 비동기 실행기가 잡지 않도록 표에 직접 넣는다.
 */
@SpringBootTest
@Testcontainers
class JudgmentRunInterruptionIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JudgmentRunService runService;

    @Autowired
    private BusinessContextService contextService;

    @Autowired
    private JudgmentExecutor executor;

    private UUID userId;
    private UUID batchId;
    private UUID contextId;

    @BeforeEach
    void setUp() {
        userId = insertUser();
        batchId = insertBatch();
        contextId = insertContext();
        jdbcTemplate.update("""
            insert into statute_version(
                statute_id, doc_type, hierarchy, effective_from, body, body_hash,
                doc_id, unit_level, title, source_url
            ) values ('소득세법-33-1-5', '법령', '법률', '2024-01-01', '원문', 'hash', 'DOC', '호', '제33조', 'https://law.go.kr/test'),
                ('소득세법시행령-61-1-1', '법령', '시행령', '2024-01-01', '원문', 'hash', 'DOC', '호', '제61조', 'https://law.go.kr/test')
            on conflict do nothing
            """);
    }

    @Test
    void stale_running_run_ends_with_its_pending_items_interrupted() {
        UUID runId = insertRun("RUNNING", "10 minutes");
        UUID done = insertItem(runId, "SUCCEEDED");
        UUID left = insertItem(runId, "PENDING");
        jdbcTemplate.update("update judgment_run set processed_count = 1 where id = ?", runId);

        runService.interruptStale();

        assertThat(run(runId))
            .containsEntry("status", "PARTIAL_FAILED")
            .containsEntry("processed_count", 1)
            .containsEntry("failed_count", 1);
        assertThat(run(runId).get("completed_at")).isNotNull();
        assertThat(item(runId, done)).containsEntry("status", "SUCCEEDED");
        assertThat(item(runId, left))
            .containsEntry("status", "FAILED")
            .containsEntry("error_code", "RUN_INTERRUPTED");
        assertThat(item(runId, left).get("processed_at")).isNotNull();
    }

    @Test
    void stale_queued_run_that_never_started_fails() {
        UUID runId = insertRun("QUEUED", "10 minutes");
        UUID left = insertItem(runId, "PENDING");

        runService.interruptStale();

        assertThat(run(runId))
            .containsEntry("status", "FAILED")
            .containsEntry("failed_count", 1);
        assertThat(item(runId, left)).containsEntry("error_code", "RUN_INTERRUPTED");
    }

    @Test
    void run_that_failed_to_start_lists_its_items_as_failures() {
        UUID runId = insertRun("QUEUED", "1 minute");
        UUID left = insertItem(runId, "PENDING");

        runService.fail(runId);

        assertThat(run(runId))
            .containsEntry("status", "FAILED")
            .containsEntry("failed_count", 1);
        assertThat(item(runId, left))
            .containsEntry("status", "FAILED")
            .containsEntry("error_code", "RUN_START_FAILED");
        assertThat(runService.failures(userId, runId, 0, 20).getContent())
            .singleElement()
            .satisfies(failure -> assertThat(failure.transactionId()).isEqualTo(left));
    }

    @Test
    void run_with_recent_progress_is_left_running() {
        UUID runId = insertRun("RUNNING", "1 minute");
        UUID left = insertItem(runId, "PENDING");

        runService.interruptStale();

        assertThat(run(runId)).containsEntry("status", "RUNNING");
        assertThat(item(runId, left)).containsEntry("status", "PENDING");
    }

    @Test
    void runner_stops_without_overwriting_once_its_run_was_interrupted() {
        UUID runId = insertRun("RUNNING", "10 minutes");
        UUID left = insertItem(runId, "PENDING");
        BusinessContext context = contextService.find(userId, contextId);
        runService.interruptStale();

        boolean judged = runService.judgeItem(runId, left, context, executor.references());
        runService.recordFailure(runId, left);
        runService.complete(runId);

        assertThat(judged).isFalse();
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from judgment where run_id = ?", Integer.class, runId
        )).isZero();
        assertThat(item(runId, left)).containsEntry("error_code", "RUN_INTERRUPTED");
        assertThat(run(runId))
            .containsEntry("status", "FAILED")
            .containsEntry("failed_count", 1);
    }

    @Test
    void interrupted_queued_run_is_not_started_later() {
        UUID runId = insertRun("QUEUED", "10 minutes");
        insertItem(runId, "PENDING");
        runService.interruptStale();

        assertThat(runService.start(runId)).isEmpty();
        assertThat(run(runId)).containsEntry("status", "FAILED");
    }

    @Test
    void judging_an_item_records_progress() {
        UUID runId = insertRun("RUNNING", "10 minutes");
        UUID left = insertItem(runId, "PENDING");

        boolean judged = runService.judgeItem(
            runId, left, contextService.find(userId, contextId), executor.references()
        );
        runService.interruptStale();

        assertThat(judged).isTrue();
        assertThat(run(runId)).containsEntry("status", "RUNNING");
    }

    private Map<String, Object> run(UUID runId) {
        return jdbcTemplate.queryForMap("select * from judgment_run where id = ?", runId);
    }

    private Map<String, Object> item(UUID runId, UUID transactionId) {
        return jdbcTemplate.queryForMap(
            "select * from judgment_run_item where run_id = ? and transaction_id = ?", runId, transactionId
        );
    }

    private UUID insertRun(String status, String sinceLastProgress) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment_run(id, batch_id, context_id, context_version, status, total_count, started_at, last_progress_at)
            values (?, ?, ?, 1, ?, 0, case when ? = 'RUNNING' then now() - ?::interval end, now() - ?::interval)
            """, id, batchId, contextId, status, status, sinceLastProgress, sinceLastProgress);
        return id;
    }

    private UUID insertItem(UUID runId, String status) {
        UUID transactionId = insertTransaction();
        jdbcTemplate.update("""
            insert into judgment_run_item(run_id, transaction_id, status, processed_at)
            values (?, ?, ?, case when ? = 'PENDING' then null else now() end)
            """, runId, transactionId, status, status);
        jdbcTemplate.update("update judgment_run set total_count = total_count + 1 where id = ?", runId);
        return transactionId;
    }

    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("insert into app_user(id, email) values (?, ?)", id, id + "@example.com");
        return id;
    }

    private UUID insertBatch() {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into upload_batch(id, user_id, source_type, card_issuer, period_start, period_end, file_hash)
            values (?, ?, '승인내역', '국민', '2025-01-01', '2025-12-31', ?)
            """, id, userId, id.toString());
        return id;
    }

    private UUID insertContext() {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into user_context(
                id, user_id, industry_code, prev_year_revenue, business_open_date,
                bookkeeping_duty, has_employee, version
            ) values (?, ?, '940909', 30000000, '2023-01-01', '간편장부', false, 1)
            """, id, userId);
        return id;
    }

    private UUID insertTransaction() {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, '2025-10-08', '가맹점', '가맹점', '카페', 6500, ?, 'JUDGEABLE', 'AUTO', 'CLASSIFIED')
            """, id, batchId, userId, id.toString());
        return id;
    }
}
