package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentRun;
import com.ktc4.pusan4.judgment.domain.JudgmentRunStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.willThrow;

/**
 * 판정 대기열이 가득 차 run 을 받지 못하면, run 생성은 그대로 성공하고 그 run 은 바로 RUN_START_FAILED 로 끝난다.
 * 거절은 run 을 만든 트랜잭션의 커밋 뒤에 일어나므로, 실패 기록이 새 트랜잭션으로 실제 커밋되는지를 본다.
 */
@SpringBootTest
@Testcontainers
class JudgmentRunRejectionIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JudgmentRunService runService;

    @MockitoBean(name = "judgmentRunExecutor")
    private TaskExecutor executor;

    @Test
    void run_rejected_by_a_full_queue_fails_to_start_and_lists_its_items() {
        willThrow(new TaskRejectedException("full")).given(executor).execute(any(Runnable.class));
        UUID userId = insertUser();
        UUID batchId = insertBatch(userId);
        UUID contextId = insertContext(userId);
        UUID transactionId = insertTransaction(userId, batchId);

        JudgmentRun created = runService.create(userId, batchId, contextId);

        assertThat(created.status()).isEqualTo(JudgmentRunStatus.QUEUED);
        assertThat(runService.get(userId, created.id()).status()).isEqualTo(JudgmentRunStatus.FAILED);
        assertThat(runService.failures(userId, created.id(), 0, 20).getContent())
            .singleElement()
            .satisfies(failure -> {
                assertThat(failure.transactionId()).isEqualTo(transactionId);
                assertThat(failure.errorCode()).isEqualTo("RUN_START_FAILED");
            });
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

    private UUID insertTransaction(UUID userId, UUID batchId) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, '2025-10-08', '스타벅스', '스타벅스', '카페', 6500, ?, 'JUDGEABLE', 'AUTO', 'CLASSIFIED')
            """, id, batchId, userId, id.toString());
        return id;
    }
}
