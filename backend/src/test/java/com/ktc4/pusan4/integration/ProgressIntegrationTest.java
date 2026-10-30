package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.judgment.domain.AnswerSource;
import com.ktc4.pusan4.judgment.domain.JudgmentOrigin;
import com.ktc4.pusan4.judgment.domain.JudgmentOriginType;
import com.ktc4.pusan4.judgment.persistence.JudgmentExecutor;
import com.ktc4.pusan4.judgment.persistence.QuestionAnswerService;
import com.ktc4.pusan4.shared.auth.FixedUser;
import com.ktc4.pusan4.user.domain.BusinessContext;
import com.ktc4.pusan4.user.persistence.BusinessContextService;
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

import java.util.List;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 진행 상황 (api.md 3.14). 다음 할 일의 분기는 NextStepTest 가 본다. 여기서는 값을 모으는 것과 사용자 경계를 본다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ProgressIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final UUID USER_ID = FixedUser.ID;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JudgmentExecutor executor;

    @Autowired
    private BusinessContextService contextService;

    @Autowired
    private QuestionAnswerService answerService;

    private BusinessContext context;

    @BeforeEach
    void setUp() {
        for (String statuteId : List.of("소득세법-33-1-5", "소득세법시행령-61-1-1", "소득세법-27-1", "소득세법-35-1")) {
            jdbcTemplate.update("""
                insert into statute_version(
                    statute_id, doc_type, hierarchy, effective_from, body, body_hash,
                    doc_id, unit_level, title, source_url
                ) values (?, '법령', '법률', '2024-01-01', '원문', 'hash', 'DOC', '호', ?, 'https://law.go.kr/test')
                on conflict do nothing
                """, statuteId, statuteId);
        }
        UUID contextId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into user_context(
                id, user_id, industry_code, prev_year_revenue, business_open_date,
                bookkeeping_duty, has_employee, version
            ) values (?, ?, '940909', 54000000, '2023-01-01', '복식부기', false,
                (select coalesce(max(version), 0) + 1 from user_context where user_id = ?))
            """, contextId, USER_ID, USER_ID);
        context = contextService.find(USER_ID, contextId);
    }

    @Test
    void collects_the_upload_state_without_revenue() throws Exception {
        // given: 8월에 KT 를 「전용」으로 답했고, 10월 업로드에는 분류 대기 둘, KT·카페 대기 질문이 있다
        UUID august = insertBatch(USER_ID, "2025-08-01", "2025-08-31");
        UUID augustRun = insertRun(august);
        UUID augustKt = insertTransaction(august, "통신", "KT", 6_500L);
        judge(augustKt, augustRun);
        answerService.answer(USER_ID, List.of(pendingQuestion(augustKt)), "전용", AnswerSource.USER);

        UUID october = insertBatch(USER_ID, "2025-10-01", "2025-10-31");
        UUID octoberRun = insertRun(october);
        judge(insertTransaction(october, "통신", "KT", 6_500L), octoberRun);
        judge(insertTransaction(october, "카페", "스타벅스", 4_500L), octoberRun);
        insertReview(insertTransaction(october, "미분류", "가맹점A", 30_000L));
        insertReview(insertTransaction(october, "미분류", "가맹점B", 67_000L));

        // when / then
        mockMvc.perform(get("/api/v1/progress").param("batchId", october.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.batch.id").value(october.toString()))
            .andExpect(jsonPath("$.batch.label").value("국민 · 2025-10"))
            .andExpect(jsonPath("$.batch.transactionCount").value(4))
            .andExpect(jsonPath("$.context.version").value(context.version()))
            .andExpect(jsonPath("$.context.bookkeeping").value("복식부기"))
            .andExpect(jsonPath("$.context.hasEmployee").value(false))
            .andExpect(jsonPath("$.context.prevYearRevenue").doesNotExist())
            .andExpect(jsonPath("$.classification.pendingCount").value(2))
            .andExpect(jsonPath("$.classification.pendingAmount").value(97_000))
            .andExpect(jsonPath("$.run.id").value(octoberRun.toString()))
            .andExpect(jsonPath("$.run.status.code").value("COMPLETED"))
            .andExpect(jsonPath("$.questions.pendingCount").value(2))
            .andExpect(jsonPath("$.questions.pendingAmount").value(11_000))
            .andExpect(jsonPath("$.questions.fillableFromPrevious").value(1))
            .andExpect(jsonPath("$.next.step").value("CLASSIFY"))
            .andExpect(jsonPath("$.next.route").value("/preview"));
    }

    @Test
    void another_users_upload_is_not_found() throws Exception {
        UUID otherUser = UUID.randomUUID();
        jdbcTemplate.update("insert into app_user(id, email) values (?, ?)", otherUser, otherUser + "@example.com");
        UUID theirs = insertBatch(otherUser, "2025-10-01", "2025-10-31");

        mockMvc.perform(get("/api/v1/progress").param("batchId", theirs.toString()))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("BATCH_NOT_FOUND"));
    }

    private void judge(UUID transactionId, UUID runId) {
        executor.judge(transactionId, context, new JudgmentOrigin(JudgmentOriginType.RUN, runId));
    }

    private UUID pendingQuestion(UUID transactionId) {
        return jdbcTemplate.queryForObject("""
            select question.id from question_queue question join judgment on judgment.id = question.judgment_id
            where judgment.transaction_id = ? and question.status = 'PENDING'
            """, UUID.class, transactionId);
    }

    private UUID insertBatch(UUID ownerId, String periodStart, String periodEnd) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into upload_batch(id, user_id, source_type, card_issuer, period_start, period_end, file_hash)
            values (?, ?, '승인내역', '국민', ?::date, ?::date, ?)
            """, id, ownerId, periodStart, periodEnd, id.toString());
        return id;
    }

    private UUID insertRun(UUID batchId) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment_run(id, batch_id, context_id, context_version, status, total_count)
            values (?, ?, ?, ?, 'COMPLETED', 0)
            """, id, batchId, context.id(), context.version());
        return id;
    }

    private UUID insertTransaction(UUID batchId, String category, String merchantNorm, long amount) {
        UUID id = UUID.randomUUID();
        String classification = "미분류".equals(category) ? "NEEDS_REVIEW" : "CLASSIFIED";
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, '2025-10-08', ?, ?, ?, ?, ?, 'JUDGEABLE', 'AUTO', ?)
            """, id, batchId, USER_ID, merchantNorm, merchantNorm, category, amount, id.toString(), classification);
        return id;
    }

    private void insertReview(UUID transactionId) {
        jdbcTemplate.update("""
            insert into classification_review(id, transaction_id, status) values (?, ?, 'PENDING')
            """, UUID.randomUUID(), transactionId);
    }
}
