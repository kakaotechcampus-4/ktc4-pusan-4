package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.auth.TestUser;
import com.ktc4.pusan4.judgment.persistence.TransactionRecordRepository;
import com.ktc4.pusan4.transaction.persistence.UploadBatchService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.mockito.stubbing.Answer;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mockingDetails;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 조회가 여러 쿼리로 나눠 읽는 사이에 업로드가 지워지는 경우 (2026-11-08 운영 18:30:12 의 500).
 * 질문(또는 판정)을 읽은 뒤, 그 거래를 읽기 직전에 다른 트랜잭션이 업로드를 지우고 커밋하게 해 시점을 맞춘다.
 * 조회가 한 시점(REPEATABLE READ)을 보지 않으면 거래가 없어 500 이 난다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ReadDuringBatchDeleteIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final UUID USER_ID = TestUser.ID;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private UploadBatchService uploadBatchService;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @MockitoSpyBean
    private TransactionRecordRepository transactionRepository;

    private UUID batchId;

    @BeforeEach
    void setUp() {
        batchId = insertBatch();
        UUID runId = insertRun();
        UUID transactionId = insertTransaction();
        UUID judgmentId = insertJudgment(transactionId, runId);
        insertPendingQuestion(judgmentId);
        deleteBatchBeforeTransactionsAreRead();
    }

    @Test
    void question_list_read_while_its_batch_is_deleted_sees_one_snapshot() throws Exception {
        // when / then: 읽기 시작한 시점의 질문을 거래와 함께 그대로 준다
        mockMvc.perform(get("/api/v1/questions").param("batchId", batchId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items", hasSize(1)))
            .andExpect(jsonPath("$.unresolved.count").value(1));
        assertBatchDeleted();
    }

    @Test
    void judgment_list_read_while_its_batch_is_deleted_sees_one_snapshot() throws Exception {
        mockMvc.perform(get("/api/v1/judgments").param("batchId", batchId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items", hasSize(1)))
            .andExpect(jsonPath("$.items[0].transaction.amount").value(6500))
            .andExpect(jsonPath("$.page.totalElements").value(1));
        assertBatchDeleted();
    }

    /** 삭제가 정말 조회 도중에 커밋됐는지. 안 지워졌으면 이 테스트는 아무것도 확인하지 않은 것이다. */
    private void assertBatchDeleted() {
        assertThat(jdbcTemplate.queryForObject("select count(*) from upload_batch where id = ?", Integer.class, batchId))
            .isZero();
    }

    /** 처음 거래를 읽으려는 순간 한 번만, 다른 트랜잭션에서 업로드를 지우고 커밋한다. */
    private void deleteBatchBeforeTransactionsAreRead() {
        AtomicBoolean deleted = new AtomicBoolean();
        TransactionTemplate separate = new TransactionTemplate(transactionManager);
        separate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        // 저장소는 인터페이스라 callRealMethod 를 못 쓴다. 스파이의 기본 응답이 실제 저장소로 넘긴다
        Answer<?> real = mockingDetails(transactionRepository).getMockCreationSettings().getDefaultAnswer();
        doAnswer(invocation -> {
            if (deleted.compareAndSet(false, true)) {
                separate.executeWithoutResult(status -> uploadBatchService.delete(USER_ID, batchId));
            }
            return real.answer(invocation);
        }).when(transactionRepository).findByIdIn(any());
    }

    private UUID insertBatch() {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into upload_batch(id, user_id, source_type, card_issuer, period_start, period_end, file_hash)
            values (?, ?, '승인내역', '국민', '2025-01-01', '2025-12-31', ?)
            """, id, USER_ID, id.toString());
        return id;
    }

    private UUID insertRun() {
        UUID contextId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into user_context(
                id, user_id, industry_code, prev_year_revenue, business_open_date,
                bookkeeping_duty, has_employee, version
            ) values (?, ?, '940909', 30000000, '2023-01-01', '간편장부', false,
                (select coalesce(max(version), 0) + 1 from user_context where user_id = ?))
            """, contextId, USER_ID, USER_ID);
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment_run(id, batch_id, context_id, context_version, status, total_count)
            values (?, ?, ?, 1, 'COMPLETED', 0)
            """, id, batchId, contextId);
        return id;
    }

    private UUID insertTransaction() {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, '2025-10-08', '스타벅스 서면점', '스타벅스', '카페', 6500, ?, 'JUDGEABLE', 'AUTO', 'CLASSIFIED')
            """, id, batchId, USER_ID, id.toString());
        return id;
    }

    private UUID insertJudgment(UUID transactionId, UUID runId) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment(
                id, transaction_id, revision, rules_commit_sha, user_context_version, tax_year, verdict,
                is_inference, run_id
            ) values (?, ?, 1, 'fixture', 1, 2025, 'UNAVAILABLE', false, ?)
            """, id, transactionId, runId);
        CurrentJudgments.refresh(jdbcTemplate);
        return id;
    }

    private void insertPendingQuestion(UUID judgmentId) {
        jdbcTemplate.update("""
            insert into question_queue(
                id, judgment_id, reason_code, question_text, group_key, fact_type, options, status
            ) values (?, ?, 'Q-TEST', '용도가 무엇인가요?', 'merchant:스타벅스', '용도', '["사업", "개인"]', 'PENDING')
            """, UUID.randomUUID(), judgmentId);
    }
}
