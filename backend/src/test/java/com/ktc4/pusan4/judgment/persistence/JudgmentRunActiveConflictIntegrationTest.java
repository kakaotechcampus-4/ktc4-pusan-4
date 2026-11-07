package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentRun;
import com.ktc4.pusan4.shared.api.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.core.task.TaskExecutor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * 같은 batch 에는 진행 중인 run 이 하나만 있을 수 있다(#191·#187, api.md 3.6).
 * 판정 실행기를 목으로 두어 만든 run 이 QUEUED 로 남게 한다.
 */
@SpringBootTest
@Testcontainers
class JudgmentRunActiveConflictIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JudgmentRunService runService;

    @MockitoBean(name = "judgmentRunExecutor")
    private TaskExecutor executor;

    private UUID userId;
    private UUID batchId;
    private UUID contextId;

    @BeforeEach
    void setUp() {
        userId = insertUser();
        batchId = insertBatch(userId);
        contextId = insertContext(userId);
        insertTransaction(userId, batchId);
    }

    @Test
    void second_run_of_a_batch_with_an_active_run_is_a_conflict_naming_the_active_run() {
        // given
        JudgmentRun active = runService.create(userId, batchId, contextId);

        // when
        ApiException conflict = catchThrowableOfType(ApiException.class,
            () -> runService.create(userId, batchId, contextId));

        // then: 화면이 진행 중인 run(/run/{runId})으로 갈 수 있게 그 id 를 준다
        assertThat(conflict.getStatus()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(conflict.getCode()).isEqualTo("RUN_ALREADY_ACTIVE");
        assertThat(conflict.getRunId()).isEqualTo(active.id().toString());
    }

    @Test
    void finished_run_does_not_block_a_rerun() {
        // given: "다시 판정하기"(api.md 3.6 재실행)는 끝난 run 뒤에 새 run 을 만든다
        JudgmentRun finished = runService.create(userId, batchId, contextId);
        jdbcTemplate.update("update judgment_run set status = 'COMPLETED' where id = ?", finished.id());

        // when
        JudgmentRun rerun = runService.create(userId, batchId, contextId);

        // then
        assertThat(rerun.id()).isNotEqualTo(finished.id());
    }

    @Test
    void run_without_progress_for_the_stale_period_does_not_block() {
        // given: 서버가 내려가 QUEUED 로 남은 run. 정리 작업(interruptStale)이 끝내기 전이다
        JudgmentRun stale = runService.create(userId, batchId, contextId);
        jdbcTemplate.update("update judgment_run set last_progress_at = now() - interval '6 minutes' where id = ?",
            stale.id());

        // when
        JudgmentRun next = runService.create(userId, batchId, contextId);

        // then
        assertThat(next.id()).isNotEqualTo(stale.id());
    }

    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("insert into app_user(id, email) values (?, ?)", id, id + "@example.com");
        return id;
    }

    private UUID insertBatch(UUID userId) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into upload_batch(id, user_id, source_type, card_issuer, period_start, period_end, file_hash)
            values (?, ?, '승인내역', '국민', '2025-01-01', '2025-12-31', ?)
            """, id, userId, id.toString());
        return id;
    }

    private UUID insertContext(UUID userId) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into user_context(
                id, user_id, industry_code, prev_year_revenue, business_open_date,
                bookkeeping_duty, has_employee, version
            ) values (?, ?, '940909', 30000000, '2023-01-01', '간편장부', false, 1)
            """, id, userId);
        return id;
    }

    private void insertTransaction(UUID userId, UUID batchId) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, '2025-10-08', '스타벅스', '스타벅스', '카페', 6500, ?, 'JUDGEABLE', 'AUTO', 'CLASSIFIED')
            """, id, batchId, userId, id.toString());
    }
}
