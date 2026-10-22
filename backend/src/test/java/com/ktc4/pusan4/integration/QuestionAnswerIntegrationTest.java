package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.judgment.domain.JudgmentOrigin;
import com.ktc4.pusan4.judgment.domain.JudgmentOriginType;
import com.ktc4.pusan4.judgment.persistence.JudgmentExecutor;
import com.ktc4.pusan4.shared.auth.FixedUser;
import com.ktc4.pusan4.user.domain.BusinessContext;
import com.ktc4.pusan4.user.persistence.BusinessContextService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 확인 질문 응답과 부분 재판정 (api.md 3.10). 실제 규칙 카드(../rules)로 판정한다.
 * 통신(R-205)은 가맹점 단위(merchant_norm)로 「전용여부」를, 카페(R-300)는 거래 단위로 「용도」를 묻는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class QuestionAnswerIntegrationTest {

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

    private UUID batchId;
    private BusinessContext context;
    private UUID runId;

    @BeforeEach
    void setUp() {
        for (String statuteId : List.of("소득세법-33-1-5", "소득세법시행령-61-1-1", "소득세법-27-1", "소득세법-35-1",
            "소득세법-160의2-2", "소득세법시행령-208의2-1-1", "소득세법-81의6-1")) {
            jdbcTemplate.update("""
                insert into statute_version(
                    statute_id, doc_type, hierarchy, effective_from, body, body_hash,
                    doc_id, unit_level, title, source_url
                ) values (?, '법령', '법률', '2024-01-01', '원문', 'hash', 'DOC', '호', ?, 'https://law.go.kr/test')
                on conflict do nothing
                """, statuteId, statuteId);
        }
        batchId = insertBatch();
        context = insertContext();
        runId = insertRun(context);
    }

    @Test
    void first_answer_answers_siblings_and_rejudges_judged_transactions_of_the_merchant() throws Exception {
        // given: 같은 통신사 거래 둘(가맹점 단위 질문), 같은 가맹점의 카페 거래, 아직 판정하지 않은 통신 거래
        UUID first = insertTransaction("통신", "KT");
        UUID second = insertTransaction("통신", "KT");
        UUID cafe = insertTransaction("카페", "KT");
        UUID notJudged = insertTransaction("통신", "KT");
        judge(first);
        judge(second);
        judge(cafe);
        UUID firstQuestion = pendingQuestion(first, "전용여부");
        UUID secondQuestion = pendingQuestion(second, "전용여부");

        // when: 한 질문에만 답한다
        answer(List.of(firstQuestion), "전용")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.answeredCount").value(2))
            .andExpect(jsonPath("$.rejudgedTransactionCount").value(3));

        // then: 형제 질문까지 같은 UserFact 로 답해지고, 판정한 적 있는 가맹점 거래만 그 UserFact 로 재판정된다
        UUID factId = jdbcTemplate.queryForObject(
            "select id from user_fact where batch_id = ? and scope_key = 'merchant:KT'", UUID.class, batchId);
        assertThat(jdbcTemplate.queryForList(
            "select answered_fact_id from question_queue where id in (?, ?) and status = 'ANSWERED'",
            UUID.class, firstQuestion, secondQuestion)).containsExactly(factId, factId);
        assertThat(jdbcTemplate.queryForList("""
            select transaction_id from judgment where trigger_user_fact_id = ?
            """, UUID.class, factId)).containsExactlyInAnyOrder(first, second, cafe);
        assertThat(latestVerdict(first)).isEqualTo("AVAILABLE");
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from judgment where transaction_id = ?", Integer.class, notJudged)).isZero();
    }

    /**
     * 일괄 응답(api.md 3.11)이 소명 대기 거래를 통째로 빼도 되는 근거다. 소명 답이 「개인」이면 불가가 확정되어
     * 같은 거래의 다른 질문(증빙유무)은 더 묻지 않는다 (worklog/be/2026-10-07-judgment-question-response-fields.md).
     */
    @Test
    void personal_answer_to_awaiting_explanation_cancels_other_questions_of_the_transaction() throws Exception {
        // given: 3만원 넘는 생활용품 — 기본 불가(R-207)로 「용도」를 묻고, 적격증빙(R-060)도 묻는다
        UUID household = insertTransaction("생활용품", "다이소", 45_000L);
        judge(household);
        UUID purpose = pendingQuestion(household, "용도");
        UUID receipt = pendingQuestion(household, "증빙유무");

        // when
        answer(List.of(purpose), "개인").andExpect(status().isOk());

        // then: 불가가 확정되고 증빙 질문은 취소되며, 새로 묻는 질문도 없다
        assertThat(latestVerdict(household)).isEqualTo("UNAVAILABLE");
        assertThat(jdbcTemplate.queryForObject(
            "select status from question_queue where id = ?", String.class, receipt)).isEqualTo("CANCELED");
        assertThat(jdbcTemplate.queryForObject("""
            select count(*)
            from question_queue question
            join judgment on judgment.id = question.judgment_id
            where judgment.transaction_id = ? and question.status = 'PENDING'
            """, Integer.class, household)).isZero();
    }

    @Test
    void correction_moves_every_answered_sibling_to_the_new_fact_version() throws Exception {
        // given: 이미 「전용」으로 답한 가맹점 질문 둘
        UUID first = insertTransaction("통신", "KT");
        UUID second = insertTransaction("통신", "KT");
        judge(first);
        judge(second);
        UUID firstQuestion = pendingQuestion(first, "전용여부");
        UUID secondQuestion = pendingQuestion(second, "전용여부");
        answer(List.of(firstQuestion), "전용").andExpect(status().isOk());

        // when: 다른 질문으로 「개인」으로 정정한다
        answer(List.of(secondQuestion), "개인")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.answeredCount").value(2));

        // then: 새 version 의 UserFact 를 두 질문이 함께 가리키고, 두 거래 모두 정정한 답으로 재판정된다
        UUID corrected = jdbcTemplate.queryForObject("""
            select id from user_fact where batch_id = ? and scope_key = 'merchant:KT' and version = 2
            """, UUID.class, batchId);
        assertThat(jdbcTemplate.queryForList(
            "select answered_fact_id from question_queue where id in (?, ?)", UUID.class, firstQuestion, secondQuestion
        )).containsExactly(corrected, corrected);
        assertThat(latestVerdict(first)).isEqualTo("UNAVAILABLE");
        assertThat(latestVerdict(second)).isEqualTo("UNAVAILABLE");
    }

    @Test
    void rejudges_only_current_targets_with_the_latest_context_of_the_group() throws Exception {
        // given: Context 1·2 로 각각 판정한 가맹점 질문 거래 둘, 그 뒤 제외되거나 분류가 풀린 같은 가맹점 카페 거래
        UUID first = insertTransaction("통신", "KT");
        UUID second = insertTransaction("통신", "KT");
        UUID excluded = insertTransaction("카페", "KT");
        UUID unclassified = insertTransaction("카페", "KT");
        judge(first);
        judge(excluded);
        judge(unclassified);
        BusinessContext newer = insertContext();
        executor.judge(second, newer, new JudgmentOrigin(JudgmentOriginType.RUN, insertRun(newer)));
        jdbcTemplate.update("update transaction set user_inclusion = 'EXCLUDED' where id = ?", excluded);
        jdbcTemplate.update("update transaction set classification_status = 'NEEDS_REVIEW' where id = ?", unclassified);

        // when
        answer(List.of(pendingQuestion(first, "전용여부")), "전용")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.rejudgedTransactionCount").value(2));

        // then
        assertThat(jdbcTemplate.queryForList("""
            select transaction_id from judgment where trigger_user_fact_id is not null and user_context_version = ?
            """, UUID.class, newer.version())).containsExactlyInAnyOrder(first, second);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from judgment where transaction_id in (?, ?) and trigger_user_fact_id is not null",
            Integer.class, excluded, unclassified)).isZero();
    }

    @Test
    void invalid_requests_change_nothing() throws Exception {
        // given: 가맹점 질문, 같은 batch 의 거래 단위 질문, 다른 batch 의 질문, 재판정으로 취소된 질문
        UUID telecom = insertTransaction("통신", "KT");
        judge(telecom);
        UUID canceled = pendingQuestion(telecom, "전용여부");
        judge(telecom);
        UUID merchantQuestion = pendingQuestion(telecom, "전용여부");
        UUID cafe = insertTransaction("카페", "스타벅스");
        judge(cafe);
        UUID cafeQuestion = pendingQuestion(cafe, "용도");
        UUID otherBatchQuestion = otherBatchQuestion();

        // when / then
        answer(List.of(UUID.randomUUID()), "전용")
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("QUESTION_NOT_FOUND"));
        answer(List.of(merchantQuestion, otherBatchQuestion), "전용")
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("QUESTIONS_FROM_DIFFERENT_BATCHES"));
        answer(List.of(merchantQuestion, cafeQuestion), "전용")
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("QUESTION_GROUP_MISMATCH"));
        answer(List.of(canceled), "전용")
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("QUESTION_NOT_ANSWERABLE"));
        answer(List.of(merchantQuestion), "모르겠음")
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("INVALID_ANSWER_VALUE"));
        answer(List.of(), "전용")
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        // then: UserFact 도, 답한 질문도 생기지 않았다
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from user_fact where batch_id = ?", Integer.class, batchId)).isZero();
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from question_queue where id = ? and status = 'PENDING'", Integer.class, merchantQuestion))
            .isOne();
    }

    /** 같은 사용자의 다른 batch 에 생긴 가맹점 질문. */
    private UUID otherBatchQuestion() {
        UUID mainBatchId = batchId;
        batchId = insertBatch();
        UUID transactionId = insertTransaction("통신", "KT");
        executor.judge(transactionId, context, new JudgmentOrigin(JudgmentOriginType.RUN, insertRun(context)));
        batchId = mainBatchId;
        return pendingQuestion(transactionId, "전용여부");
    }

    private ResultActions answer(List<UUID> questionIds, String value) throws Exception {
        String ids = String.join("\", \"", questionIds.stream().map(UUID::toString).toList());
        return mockMvc.perform(post("/api/v1/question-responses")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"questionIds": ["%s"], "answer": {"value": "%s"}}
                """.formatted(ids, value)));
    }

    private void judge(UUID transactionId) {
        executor.judge(transactionId, context, new JudgmentOrigin(JudgmentOriginType.RUN, runId));
    }

    private UUID pendingQuestion(UUID transactionId, String factType) {
        return jdbcTemplate.queryForObject("""
            select question.id
            from question_queue question
            join judgment on judgment.id = question.judgment_id
            where judgment.transaction_id = ? and question.fact_type = ? and question.status = 'PENDING'
            """, UUID.class, transactionId, factType);
    }

    private String latestVerdict(UUID transactionId) {
        return jdbcTemplate.queryForObject(
            "select verdict from judgment where transaction_id = ? order by revision desc limit 1",
            String.class, transactionId);
    }

    private UUID insertBatch() {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into upload_batch(id, user_id, source_type, card_issuer, period_start, period_end, file_hash)
            values (?, ?, '승인내역', '국민', '2025-01-01', '2025-12-31', ?)
            """, id, USER_ID, id.toString());
        return id;
    }

    private BusinessContext insertContext() {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into user_context(
                id, user_id, industry_code, prev_year_revenue, business_open_date,
                bookkeeping_duty, has_employee, version
            ) values (?, ?, '940909', 30000000, '2023-01-01', '간편장부', false,
                (select coalesce(max(version), 0) + 1 from user_context where user_id = ?))
            """, id, USER_ID, USER_ID);
        return contextService.find(USER_ID, id);
    }

    private UUID insertRun(BusinessContext runContext) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment_run(id, batch_id, context_id, context_version, status, total_count)
            values (?, ?, ?, ?, 'COMPLETED', 0)
            """, id, batchId, runContext.id(), runContext.version());
        return id;
    }

    private UUID insertTransaction(String category, String merchantNorm) {
        return insertTransaction(category, merchantNorm, 6_500L);
    }

    private UUID insertTransaction(String category, String merchantNorm, long amount) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, '2025-10-08', ?, ?, ?, ?, ?, 'JUDGEABLE', 'AUTO', 'CLASSIFIED')
            """, id, batchId, USER_ID, merchantNorm, merchantNorm, category, amount, id.toString());
        return id;
    }
}
