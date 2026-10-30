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

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 지난번 답 불러오기 (api.md 3.14). 같은 사용자의 다른 업로드 답만 읽고, 다른 사용자의 답은 섞이지 않는다.
 * 통신(R-205)은 carry, 카페(R-300)는 history, 주말 카페(R-312)는 소명 대기라 C 다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class QuestionSuggestionIntegrationTest {

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
    }

    @Test
    void suggests_answers_from_the_users_other_uploads_only() throws Exception {
        // given: 8월 업로드에서 KT 「전용」, 스타벅스 「업무미팅」으로 답했다
        Upload august = upload(USER_ID, "2025-08-01", "2025-08-31");
        answer(august, august.judged("통신", "KT", "2025-08-11"), "전용여부", "전용");
        answer(august, august.judged("카페", "스타벅스", "2025-08-12"), "용도", "업무미팅");
        // 다른 사용자는 같은 가맹점에 다르게 답했다
        Upload others = upload(insertUser(), "2025-09-01", "2025-09-30");
        answer(others, others.judged("통신", "KT", "2025-09-11"), "전용여부", "개인");
        answer(others, others.judged("카페", "스타벅스", "2025-09-12"), "용도", "개인");
        // 10월 업로드의 대기 질문
        Upload october = upload(USER_ID, "2025-10-01", "2025-10-31");
        october.judged("통신", "KT", "2025-10-08");
        october.judged("카페", "스타벅스", "2025-10-08");
        october.judged("카페", "스타벅스", "2025-10-11");

        // when / then
        mockMvc.perform(get("/api/v1/questions/suggestions").param("batchId", october.batchId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items", hasSize(3)))
            .andExpect(jsonPath("$.items[?(@.code == 'TELECOM_DEDICATION')].tier").value("A"))
            .andExpect(jsonPath("$.items[?(@.code == 'TELECOM_DEDICATION')].value").value("전용"))
            .andExpect(jsonPath("$.items[?(@.code == 'TELECOM_DEDICATION')].sourceLabel").value("8월 업로드(국민)"))
            .andExpect(jsonPath("$.items[?(@.code == 'CAFE_PURPOSE')].tier").value("B"))
            .andExpect(jsonPath("$.items[?(@.code == 'CAFE_PURPOSE')].historyCounts.업무미팅").value(1))
            .andExpect(jsonPath("$.items[?(@.code == 'CAFE_PURPOSE')].historyCounts.개인").doesNotExist())
            .andExpect(jsonPath("$.items[?(@.code == 'WEEKEND_CAFE_PURPOSE')].tier").value("C"))
            .andExpect(jsonPath("$.items[?(@.code == 'WEEKEND_CAFE_PURPOSE')].reason").value("소명 대기 질문은 건마다 답해야 합니다"));
    }

    @Test
    void another_users_upload_is_not_found() throws Exception {
        Upload others = upload(insertUser(), "2025-09-01", "2025-09-30");

        mockMvc.perform(get("/api/v1/questions/suggestions").param("batchId", others.batchId.toString()))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("BATCH_NOT_FOUND"));
    }

    private void answer(Upload upload, UUID transactionId, String factType, String value) {
        UUID questionId = jdbcTemplate.queryForObject("""
            select question.id from question_queue question join judgment on judgment.id = question.judgment_id
            where judgment.transaction_id = ? and question.fact_type = ? and question.status = 'PENDING'
            """, UUID.class, transactionId, factType);
        answerService.answer(upload.userId, List.of(questionId), value, AnswerSource.USER);
    }

    private Upload upload(UUID userId, String periodStart, String periodEnd) {
        UUID batchId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into upload_batch(id, user_id, source_type, card_issuer, period_start, period_end, file_hash)
            values (?, ?, '승인내역', '국민', ?::date, ?::date, ?)
            """, batchId, userId, periodStart, periodEnd, batchId.toString());
        UUID contextId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into user_context(
                id, user_id, industry_code, prev_year_revenue, business_open_date,
                bookkeeping_duty, has_employee, version
            ) values (?, ?, '940909', 30000000, '2023-01-01', '간편장부', false,
                (select coalesce(max(version), 0) + 1 from user_context where user_id = ?))
            """, contextId, userId, userId);
        BusinessContext context = contextService.find(userId, contextId);
        UUID runId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment_run(id, batch_id, context_id, context_version, status, total_count)
            values (?, ?, ?, ?, 'COMPLETED', 0)
            """, runId, batchId, contextId, context.version());
        return new Upload(userId, batchId, context, runId);
    }

    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("insert into app_user(id, email) values (?, ?)", id, id + "@example.com");
        return id;
    }

    private final class Upload {
        final UUID userId;
        final UUID batchId;
        final BusinessContext context;
        final UUID runId;

        Upload(UUID userId, UUID batchId, BusinessContext context, UUID runId) {
            this.userId = userId;
            this.batchId = batchId;
            this.context = context;
            this.runId = runId;
        }

        UUID judged(String category, String merchantNorm, String approvedAt) {
            UUID id = UUID.randomUUID();
            jdbcTemplate.update("""
                insert into transaction(
                    id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                    amount, natural_key, source_status, user_inclusion, classification_status
                ) values (?, ?, ?, ?::date, ?, ?, ?, 6500, ?, 'JUDGEABLE', 'AUTO', 'CLASSIFIED')
                """, id, batchId, userId, approvedAt, merchantNorm, merchantNorm, category, id.toString());
            executor.judge(id, context, new JudgmentOrigin(JudgmentOriginType.RUN, runId));
            return id;
        }
    }
}
