package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.shared.auth.FixedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 확인 질문 조회 (api.md 3.9). 판정과 질문은 표에 직접 넣는다. 요청은 임시 사용자로 간다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class QuestionQueryIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final UUID USER_ID = FixedUser.ID;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private UUID batchId;
    private UUID runId;

    @BeforeEach
    void setUp() {
        batchId = insertBatch(USER_ID);
        runId = insertRun(batchId);
    }

    @Test
    void list_returns_questions_in_creation_order_with_answer_and_unresolved_total() throws Exception {
        // given: 같은 거래에 답한 질문과 대기 질문, 다른 거래에 대기 질문, 취소된 질문
        UUID first = insertTransaction(batchId, "2025-10-08", 6_500L);
        UUID firstJudgment = insertJudgment(first, "NEEDS_REVIEW");
        UUID factId = insertFact(batchId, "merchant:스타벅스", "용도", "사업");
        UUID answered = insertQuestion(firstJudgment, "merchant:스타벅스", "용도", "ANSWERED", factId,
            "2025-10-09T10:00:00+09:00");
        UUID pending = insertQuestion(firstJudgment, "transaction:" + first, "증빙유무", "PENDING", null,
            "2025-10-09T10:01:00+09:00");
        UUID second = insertTransaction(batchId, "2025-10-09", 3_000L);
        UUID secondJudgment = insertJudgment(second, "NEEDS_REVIEW");
        UUID otherPending = insertQuestion(secondJudgment, "merchant:스타벅스", "용도", "PENDING", null,
            "2025-10-09T10:02:00+09:00");
        UUID canceled = insertQuestion(secondJudgment, "merchant:스타벅스", "용도", "CANCELED", null,
            "2025-10-09T10:03:00+09:00");

        // when / then: 전체 목록
        mockMvc.perform(get("/api/v1/questions").param("batchId", batchId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[*].id",
                contains(answered.toString(), pending.toString(), otherPending.toString(), canceled.toString())))
            .andExpect(jsonPath("$.items[0].batchId").value(batchId.toString()))
            .andExpect(jsonPath("$.items[0].transactionId").value(first.toString()))
            .andExpect(jsonPath("$.items[0].status.code").value("ANSWERED"))
            .andExpect(jsonPath("$.items[0].status.label").value("응답"))
            .andExpect(jsonPath("$.items[0].answeredFactId").value(factId.toString()))
            .andExpect(jsonPath("$.items[0].answer.value").value("사업"))
            .andExpect(jsonPath("$.items[1].answer").isEmpty())
            .andExpect(jsonPath("$.unresolved.count").value(2))
            .andExpect(jsonPath("$.unresolved.amount").value(9_500))
            .andExpect(jsonPath("$.page.totalElements").value(4));

        // when / then: status 는 목록만 거르고 미해소 집계는 그대로다
        mockMvc.perform(get("/api/v1/questions")
                .param("batchId", batchId.toString())
                .param("status", "ANSWERED"))
            .andExpect(jsonPath("$.items[*].id", contains(answered.toString())))
            .andExpect(jsonPath("$.unresolved.count").value(2));
    }

    @Test
    void grouped_list_marks_overridden_transactions_and_groups_awaiting_explanation() throws Exception {
        // given: 스타벅스 대기 질문 둘(하나는 판정을 수정한 거래), 주말 카페 대기 질문 하나(자동 판정이 불가)
        UUID later = insertTransaction(batchId, "2025-10-20", 3_000L);
        UUID laterJudgment = insertJudgment(later, "NEEDS_REVIEW");
        UUID laterQuestion = insertQuestion(laterJudgment, "merchant:스타벅스", "용도", "PENDING", null,
            "2025-10-21T10:00:00+09:00");
        UUID overridden = insertTransaction(batchId, "2025-10-01", 10_000L);
        UUID overriddenJudgment = insertJudgment(overridden, "NEEDS_REVIEW");
        UUID overriddenQuestion = insertQuestion(overriddenJudgment, "merchant:스타벅스", "용도", "PENDING", null,
            "2025-10-21T10:01:00+09:00");
        jdbcTemplate.update("""
            insert into judgment_override(id, transaction_id, source_judgment_id, to_verdict)
            values (?, ?, ?, 'AVAILABLE')
            """, UUID.randomUUID(), overridden, overriddenJudgment);
        UUID weekend = insertTransaction(batchId, "2025-10-11", 8_000L);
        UUID weekendQuestion = insertQuestion(insertJudgment(weekend, "UNAVAILABLE"), "merchant:주말카페", "용도",
            "PENDING", null, "2025-10-21T10:02:00+09:00");

        // when / then
        mockMvc.perform(get("/api/v1/questions")
                .param("batchId", batchId.toString())
                .param("grouped", "true"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[*].groupKey", contains("merchant:스타벅스", "merchant:주말카페")))
            .andExpect(jsonPath("$.items[0].questionIds",
                contains(overriddenQuestion.toString(), laterQuestion.toString())))
            .andExpect(jsonPath("$.items[0].count").value(2))
            .andExpect(jsonPath("$.items[0].totalAmount").value(13_000))
            .andExpect(jsonPath("$.items[0].bulkAnswerable").value(true))
            .andExpect(jsonPath("$.items[0].transactions[0].transactionId").value(overridden.toString()))
            .andExpect(jsonPath("$.items[0].transactions[0].overridden").value(true))
            .andExpect(jsonPath("$.items[0].transactions[1].overridden").value(false))
            .andExpect(jsonPath("$.items[1].questionIds", contains(weekendQuestion.toString())))
            .andExpect(jsonPath("$.items[1].bulkAnswerable").value(false))
            .andExpect(jsonPath("$.unresolved.count").value(3))
            .andExpect(jsonPath("$.page.totalElements").value(2));
    }

    @Test
    void questions_of_transactions_not_judged_now_are_left_out_until_included_again() throws Exception {
        // given: 대기 질문이 걸린 거래 둘 중 하나를 사용자가 판정 대상에서 뺐다
        UUID kept = insertTransaction(batchId, "2025-10-08", 6_500L);
        UUID keptQuestion = insertQuestion(insertJudgment(kept, "NEEDS_REVIEW"), "merchant:스타벅스", "용도",
            "PENDING", null, "2025-10-09T10:00:00+09:00");
        UUID excluded = insertTransaction(batchId, "2025-10-09", 3_000L);
        UUID excludedQuestion = insertQuestion(insertJudgment(excluded, "NEEDS_REVIEW"), "merchant:스타벅스", "용도",
            "PENDING", null, "2025-10-09T10:01:00+09:00");
        jdbcTemplate.update("update transaction set user_inclusion = 'EXCLUDED' where id = ?", excluded);

        // when / then: 목록·그룹·미해소 집계에서 빠지고, 거래를 지정해도 빠진다
        mockMvc.perform(get("/api/v1/questions").param("batchId", batchId.toString()))
            .andExpect(jsonPath("$.items[*].id", contains(keptQuestion.toString())))
            .andExpect(jsonPath("$.unresolved.count").value(1))
            .andExpect(jsonPath("$.unresolved.amount").value(6_500));
        mockMvc.perform(get("/api/v1/questions")
                .param("batchId", batchId.toString())
                .param("grouped", "true"))
            .andExpect(jsonPath("$.items[0].questionIds", contains(keptQuestion.toString())));
        mockMvc.perform(get("/api/v1/questions").param("transactionId", excluded.toString()))
            .andExpect(jsonPath("$.items").isEmpty())
            .andExpect(jsonPath("$.unresolved.count").value(0));

        // when / then: 다시 포함하면 질문이 그대로 돌아온다
        jdbcTemplate.update("update transaction set user_inclusion = 'INCLUDED' where id = ?", excluded);
        mockMvc.perform(get("/api/v1/questions").param("batchId", batchId.toString()))
            .andExpect(jsonPath("$.items[*].id", contains(keptQuestion.toString(), excludedQuestion.toString())))
            .andExpect(jsonPath("$.unresolved.count").value(2));
    }

    @Test
    void list_never_returns_another_users_questions() throws Exception {
        // given: 다른 사용자의 거래에 걸린 대기 질문
        UUID otherBatchId = insertBatch(insertUser());
        UUID otherRunId = insertRun(otherBatchId);
        UUID transactionId = insertTransaction(otherBatchId, "2025-10-08", 6_500L);
        UUID judgmentId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment(
                id, transaction_id, revision, rules_commit_sha, user_context_version, tax_year, verdict,
                is_inference, run_id
            ) values (?, ?, 1, 'fixture', 1, 2025, 'NEEDS_REVIEW', false, ?)
            """, judgmentId, transactionId, otherRunId);
        insertQuestion(judgmentId, "merchant:스타벅스", "용도", "PENDING", null, "2025-10-09T10:00:00+09:00");

        // when / then
        mockMvc.perform(get("/api/v1/questions").param("transactionId", transactionId.toString()))
            .andExpect(jsonPath("$.items").isEmpty())
            .andExpect(jsonPath("$.unresolved.count").value(0));
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

    private UUID insertRun(UUID runBatchId) {
        UUID ownerId = jdbcTemplate.queryForObject(
            "select user_id from upload_batch where id = ?", UUID.class, runBatchId);
        UUID contextId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into user_context(
                id, user_id, industry_code, prev_year_revenue, business_open_date,
                bookkeeping_duty, has_employee, version
            ) values (?, ?, '940909', 30000000, '2023-01-01', '간편장부', false,
                (select coalesce(max(version), 0) + 1 from user_context where user_id = ?))
            """, contextId, ownerId, ownerId);
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment_run(id, batch_id, context_id, context_version, status, total_count)
            values (?, ?, ?, 1, 'COMPLETED', 0)
            """, id, runBatchId, contextId);
        return id;
    }

    private UUID insertTransaction(UUID transactionBatchId, String approvedAt, long amount) {
        UUID ownerId = jdbcTemplate.queryForObject(
            "select user_id from upload_batch where id = ?", UUID.class, transactionBatchId);
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, ?::date, '스타벅스 서면점', '스타벅스', '카페', ?, ?, 'JUDGEABLE', 'AUTO', 'CLASSIFIED')
            """, id, transactionBatchId, ownerId, approvedAt, amount, id.toString());
        return id;
    }

    /** setUp 의 run 이 만든 첫 판정. */
    private UUID insertJudgment(UUID transactionId, String verdict) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment(
                id, transaction_id, revision, rules_commit_sha, user_context_version, tax_year, verdict,
                is_inference, run_id
            ) values (?, ?, 1, 'fixture', 1, 2025, ?, false, ?)
            """, id, transactionId, verdict, runId);
        return id;
    }

    private UUID insertFact(UUID factBatchId, String scopeKey, String factType, String value) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into user_fact(id, user_id, batch_id, scope_key, fact_type, value, version)
            values (?, ?, ?, ?, ?, jsonb_build_object('value', ?::text), 1)
            """, id, USER_ID, factBatchId, scopeKey, factType, value);
        return id;
    }

    private UUID insertQuestion(UUID judgmentId, String groupKey, String factType, String status,
        UUID answeredFactId, String createdAt) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into question_queue(
                id, judgment_id, reason_code, question_text, group_key, fact_type, options, status,
                answered_fact_id, created_at, answered_at
            ) values (?, ?, 'Q-TEST', '용도가 무엇인가요?', ?, ?, '["사업", "개인"]', ?, ?, ?::timestamptz,
                case when ? = 'ANSWERED' then now() end)
            """, id, judgmentId, groupKey, factType, status, answeredFactId, createdAt, status);
        return id;
    }
}
