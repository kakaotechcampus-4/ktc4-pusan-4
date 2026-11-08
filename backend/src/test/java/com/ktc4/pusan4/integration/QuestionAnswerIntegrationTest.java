package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.auth.TestUser;
import com.ktc4.pusan4.judgment.domain.AnswerSource;
import com.ktc4.pusan4.judgment.domain.JudgmentOrigin;
import com.ktc4.pusan4.judgment.domain.JudgmentOriginType;
import com.ktc4.pusan4.judgment.persistence.BulkAnswerResult;
import com.ktc4.pusan4.judgment.persistence.JudgmentExecutor;
import com.ktc4.pusan4.judgment.persistence.QuestionAnswerService;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 확인 질문 응답과 부분 재판정 (api.md 3.10), 일괄 응답 (api.md 3.11). 실제 규칙 카드(../rules)로 판정한다.
 * 통신(R-205)은 가맹점 단위(merchant_norm)로 「전용여부」를, 카페(R-300)는 거래 단위로 「용도」를 묻는다.
 * 주말 음식점(R-311)은 불가로 추정하고 「용도」로 소명을 받는다(소명 대기).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class QuestionAnswerIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final UUID USER_ID = TestUser.ID;

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

    @Autowired
    private PlatformTransactionManager transactionManager;

    private UUID batchId;
    private BusinessContext context;
    private UUID runId;

    @BeforeEach
    void setUp() {
        // 판정 저장은 카드가 인용한 조문마다 statute_version 행이 있어야 한다(StatuteVersions).
        // 208의2-4 는 R-060, 62·67-* 는 R-241(100만원 초과 생활용품) 인용이다.
        for (String statuteId : List.of("소득세법-33-1-5", "소득세법시행령-61-1-1", "소득세법-27-1", "소득세법-35-1",
            "소득세법-160의2-2", "소득세법시행령-208의2-1-1", "소득세법시행령-208의2-4", "소득세법-81의6-1",
            "소득세법시행령-62", "소득세법시행령-67-4", "소득세법시행령-67-5", "소득세법시행령-67-7", "소득세법시행령-61-1")) {
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
    void aggregated_transit_row_on_saturday_is_asked_like_a_weekday_trip() {
        // given: 한 달치 지하철을 묶은 카드사 합산 행. 날짜는 묶음 기준일인 1/31(토)이다
        UUID transit = insertTransaction("여비교통", "지하철 40건", 55_000L, "2026-01-31");
        jdbcTemplate.update("update transaction set is_aggregated = true where id = ?", transit);

        // when
        judge(transit);

        // then: 주말 여비교통(R-314, 불가)이 아니라 평일 여비교통(R-208)으로 업무 목적을 묻는다(#192)
        assertThat(jdbcTemplate.queryForMap("""
            select verdict, rule_card_id from judgment where transaction_id = ? order by revision desc limit 1
            """, transit))
            .containsEntry("verdict", "NEEDS_REVIEW")
            .containsEntry("rule_card_id", "R-208");
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
        // given: 100만원 넘는 생활용품 — 기본 불가(R-207)로 「용도」를 묻고, 자산 여부(R-241)도 묻는다
        // (예전엔 적격증빙(R-060)을 두 번째 질문으로 썼는데, 카드매출전표 자동 인정으로 묻지 않게 됐다)
        UUID household = insertTransaction("생활용품", "다이소", 1_500_000L);
        judge(household);
        UUID purpose = pendingQuestion(household, "용도");
        UUID receipt = pendingQuestion(household, "자산여부");

        // when
        answer(List.of(purpose), "개인").andExpect(status().isOk());

        // then: 불가가 확정되고 자산 질문은 취소되며, 새로 묻는 질문도 없다
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
    void answer_keeps_its_source_and_exposes_the_question_code() throws Exception {
        // given
        UUID cafe = insertTransaction("카페", "스타벅스");
        UUID telecom = insertTransaction("통신", "KT");
        judge(cafe);
        judge(telecom);
        UUID cafeQuestion = pendingQuestion(cafe, "용도");
        mockMvc.perform(get("/api/v1/questions").param("transactionId", cafe.toString()))
            .andExpect(jsonPath("$.items[0].code").value("CAFE_PURPOSE"));

        // when: 출처를 적은 답과 적지 않은 답
        mockMvc.perform(post("/api/v1/question-responses")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"questionIds": ["%s"], "answer": {"value": "업무미팅"}, "source": "PREVIOUS_ANSWER"}
                    """.formatted(cafeQuestion)))
            .andExpect(status().isOk());
        answer(List.of(pendingQuestion(telecom, "전용여부")), "전용").andExpect(status().isOk());

        // then
        assertThat(jdbcTemplate.queryForList(
            "select source from user_fact where batch_id = ? order by scope_key", String.class, batchId))
            .containsExactly("USER", "PREVIOUS_ANSWER");
    }

    @Test
    void clients_cannot_claim_a_bulk_answer_source() throws Exception {
        UUID cafe = insertTransaction("카페", "스타벅스");
        judge(cafe);

        mockMvc.perform(post("/api/v1/question-responses")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"questionIds": ["%s"], "answer": {"value": "업무미팅"}, "source": "BULK"}
                    """.formatted(pendingQuestion(cafe, "용도"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from user_fact where batch_id = ?", Integer.class, batchId)).isZero();
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

    @Test
    void answer_that_makes_an_entertainment_expense_settles_the_limit() throws Exception {
        // given
        UUID cafe = insertTransaction("카페", "스타벅스");
        judge(cafe);

        // when: 업무미팅 → 가능(접대비)
        answer(List.of(pendingQuestion(cafe, "용도")), "업무미팅").andExpect(status().isOk());

        // then: 재판정한 revision 이 한도 항목에 들어간다
        assertThat(jdbcTemplate.queryForMap("""
            select entry.judgment_id, entry.allowed_amount
            from limit_bucket_entry entry
            join judgment on judgment.id = entry.judgment_id
            where judgment.transaction_id = ?
            """, cafe))
            .containsEntry("judgment_id", jdbcTemplate.queryForObject(
                "select id from judgment where transaction_id = ? order by revision desc limit 1", UUID.class, cafe))
            .containsEntry("allowed_amount", 6_500L);
    }

    @Test
    void answer_unrelated_to_entertainment_does_not_settle_the_limit() throws Exception {
        // given: 업무미팅 접대비 한 건. 한도 항목 값을 집계가 내지 않을 값으로 바꿔 둔다
        // 바꾼 값이 남으므로, 같은 사용자를 쓰는 다른 테스트와 겹치지 않는 해(평일)에 둔다
        UUID meeting = insertTransaction("카페", "스타벅스", 6_500L, "2033-03-02");
        UUID telecom = insertTransaction("통신", "KT");
        List.of(meeting, telecom).forEach(this::judge);
        answer(List.of(pendingQuestion(meeting, "용도")), "업무미팅").andExpect(status().isOk());
        jdbcTemplate.update("""
            update limit_bucket_entry set allowed_amount = 3000
            where judgment_id in (select id from judgment where transaction_id = ?)
            """, meeting);

        // when: 어느 판정도 접대비가 아닌 거래의 답
        answer(List.of(pendingQuestion(telecom, "전용여부")), "전용").andExpect(status().isOk());

        // then: 집계를 건너뛰어 한도 항목이 그대로다 (#218)
        assertThat(jdbcTemplate.queryForList("""
            select allowed_amount from limit_bucket_entry
            where judgment_id in (select id from judgment where transaction_id = ?)
            """, Long.class, meeting))
            .containsExactly(3_000L);
    }

    @Test
    void correcting_an_entertainment_answer_settles_the_limit_again() throws Exception {
        // given
        UUID meeting = insertTransaction("카페", "스타벅스");
        judge(meeting);
        UUID question = pendingQuestion(meeting, "용도");
        answer(List.of(question), "업무미팅").andExpect(status().isOk());

        // when: 새 판정은 접대비가 아니지만, 이전 판정이 접대비였다
        answer(List.of(question), "개인").andExpect(status().isOk());

        // then: 이전 판정의 한도 항목이 빠진다
        assertThat(jdbcTemplate.queryForObject("""
            select count(*) from limit_bucket_entry
            where judgment_id in (select id from judgment where transaction_id = ?)
            """, Integer.class, meeting)).isZero();
    }

    @Test
    void current_judgment_follows_rejudge_override_and_release() throws Exception {
        // given: 자동 판정 하나
        UUID cafe = insertTransaction("카페", "스타벅스");
        judge(cafe);
        UUID automatic = latestJudgment(cafe);
        assertThat(currentJudgment(cafe)).isEqualTo(automatic);

        // when: 사용자가 불가로 수정한 뒤 다시 판정한다
        mockMvc.perform(post("/api/v1/judgments/{id}/override", automatic)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"toVerdict": "UNAVAILABLE"}
                    """))
            .andExpect(status().isOk());
        UUID overridden = latestJudgment(cafe);
        judge(cafe);
        UUID rejudged = latestJudgment(cafe);

        // then: 활성 수정이 있는 동안은 새 자동 판정이 생겨도 수정 revision 이 현재다 (api.md 3.8)
        assertThat(rejudged).isNotEqualTo(overridden);
        assertThat(currentJudgment(cafe)).isEqualTo(overridden);

        // when: 수정을 해제한다
        UUID overrideId = jdbcTemplate.queryForObject(
            "select id from judgment_override where transaction_id = ? and active", UUID.class, cafe);
        mockMvc.perform(delete("/api/v1/judgment-overrides/{id}", overrideId)).andExpect(status().isNoContent());

        // then: override 가 아닌 최신 revision 으로 돌아가고, 저장된 현재 판정이 모든 거래에서 정의(§5)와 같다
        assertThat(currentJudgment(cafe)).isEqualTo(rejudged);
        assertThat(CurrentJudgments.mismatches(jdbcTemplate)).isZero();
    }

    @Test
    void home_office_answer_saves_the_amount_apportioned_by_the_context_ratio() throws Exception {
        // given: 문진 작업공간 비율 20%, 전기요금 8만원(R-103 공간전용여부)
        jdbcTemplate.update("update user_context set home_office_ratio = 20 where id = ?", context.id());
        UUID utility = insertTransaction("수도광열", "한국전력공사", 80_000L);
        judge(utility);
        assertThat(jdbcTemplate.queryForObject(
            "select final_amount from judgment where transaction_id = ?", Long.class, utility)).isZero();

        // when
        answer(List.of(pendingQuestion(utility, "공간전용여부")), "자택 겸용(작업 공간이 따로 나뉨)").andExpect(status().isOk());

        // then: 가능이 되고 금액은 8만원 × 20%
        assertThat(jdbcTemplate.queryForMap(
            "select verdict, final_amount from judgment where transaction_id = ? order by revision desc limit 1",
            utility)).containsEntry("verdict", "AVAILABLE").containsEntry("final_amount", 16_000L);
    }

    @Test
    void bulk_answer_closes_pending_questions_of_the_fact_type_except_awaiting_explanation() throws Exception {
        // given: 카페 둘(용도), 주말 음식점(용도, 소명 대기), 통신(전용여부)
        UUID firstCafe = insertTransaction("카페", "스타벅스");
        UUID secondCafe = insertTransaction("카페", "이디야");
        UUID weekend = insertTransaction("음식점", "김밥천국", 6_500L, "2025-10-11");
        UUID telecom = insertTransaction("통신", "KT");
        List.of(firstCafe, secondCafe, weekend, telecom).forEach(this::judge);

        // when: 「혼자작업」은 카페만 받는 값이다. 소명 대기 질문은 허용 검사에도 넣지 않는다
        bulkAnswer(batchId, "용도", "혼자작업")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.answeredCount").value(2))
            .andExpect(jsonPath("$.skippedCount").value(1))
            .andExpect(jsonPath("$.excludedCount").value(1))
            .andExpect(jsonPath("$.factIds.length()").value(2))
            .andExpect(jsonPath("$.rejudgedTransactionCount").value(2))
            .andExpect(jsonPath("$.unresolved.count").value(2))
            .andExpect(jsonPath("$.unresolved.amount").value(13_000));

        // then: 거래 단위 질문이라 그룹마다 UserFact 가 하나씩 생기고, 카페만 그 답으로 한 번씩 재판정된다
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from user_fact where batch_id = ? and fact_type = '용도'", Integer.class, batchId))
            .isEqualTo(2);
        assertThat(latestVerdict(firstCafe)).isEqualTo("UNAVAILABLE");
        assertThat(latestVerdict(secondCafe)).isEqualTo("UNAVAILABLE");
        assertThat(jdbcTemplate.queryForList("""
            select judgment.transaction_id
            from judgment
            join transaction on transaction.id = judgment.transaction_id
            where transaction.batch_id = ? and judgment.trigger_user_fact_id is not null
            """, UUID.class, batchId)).containsExactlyInAnyOrder(firstCafe, secondCafe);
        assertThat(pendingQuestion(weekend, "용도")).isNotNull();
        assertThat(pendingQuestion(telecom, "전용여부")).isNotNull();
        // 지난번 답 불러오기가 약한 근거로 다루도록 출처를 일괄 응답으로 남긴다
        assertThat(jdbcTemplate.queryForList(
            "select distinct source from user_fact where batch_id = ?", String.class, batchId))
            .containsExactly("BULK");
    }

    @Test
    void bulk_answer_reports_unresolved_after_the_rejudge_canceled_other_questions() throws Exception {
        // given: 100만원 넘는 전자기기는 용도(R-211)와 즉시상각여부(R-244)를 함께 묻는다. 소명 대기가 아니라 일괄 응답 대상이다
        UUID device = insertTransaction("전자기기", "애플", 1_500_000L);
        judge(device);
        assertThat(pendingQuestion(device, "즉시상각여부")).isNotNull();

        // when / then: 「개인」이면 불가로 확정되어 즉시상각여부 질문도 취소된다. 남은 질문은 없다
        bulkAnswer(batchId, "용도", "개인")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.answeredCount").value(1))
            .andExpect(jsonPath("$.unresolved.count").value(0))
            .andExpect(jsonPath("$.unresolved.amount").value(0));
    }

    @Test
    void bulk_answer_counts_only_questions_it_turned_from_pending() throws Exception {
        // given: 같은 가맹점 질문 둘 중 하나만 대기다. 나머지는 이미 답했다(상태는 직접 만든다)
        UUID first = insertTransaction("통신", "KT");
        UUID second = insertTransaction("통신", "KT");
        judge(first);
        judge(second);
        UUID secondQuestion = pendingQuestion(second, "전용여부");
        answer(List.of(pendingQuestion(first, "전용여부")), "전용").andExpect(status().isOk());
        jdbcTemplate.update("""
            update question_queue set status = 'PENDING', answered_fact_id = null, answered_at = null where id = ?
            """, secondQuestion);

        // when / then: 이미 ANSWERED 였던 형제 질문은 세지 않는다 (api.md 3.11 answeredCount)
        bulkAnswer(batchId, "전용여부", "개인")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.answeredCount").value(1));
    }

    @Test
    void bulk_answer_with_only_excluded_targets_answers_nothing() throws Exception {
        // given: 「용도」 질문은 소명 대기 거래에만 있다
        UUID weekend = insertTransaction("음식점", "김밥천국", 6_500L, "2025-10-11");
        judge(weekend);

        // when / then: 이력이 있으니 에러가 아니다
        bulkAnswer(batchId, "용도", "업무미팅")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.answeredCount").value(0))
            .andExpect(jsonPath("$.excludedCount").value(1))
            .andExpect(jsonPath("$.factIds.length()").value(0))
            .andExpect(jsonPath("$.rejudgedTransactionCount").value(0));
        assertThat(latestVerdict(weekend)).isEqualTo("UNAVAILABLE");
    }

    @Test
    void bulk_answer_waits_for_the_user_lock_before_reading_its_targets() throws Exception {
        // given: 카페 용도 질문. 다른 응답이 사용자 락을 잡은 채 그 질문을 취소하고 아직 커밋하지 않았다
        UUID cafe = insertTransaction("카페", "스타벅스");
        judge(cafe);
        UUID question = pendingQuestion(cafe, "용도");
        CountDownLatch canceled = new CountDownLatch(1);
        CountDownLatch commit = new CountDownLatch(1);
        ExecutorService threads = Executors.newFixedThreadPool(2);
        try {
            Future<?> other = threads.submit(() ->
                new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                    jdbcTemplate.queryForList("select id from app_user where id = ? for no key update", USER_ID);
                    jdbcTemplate.update("update question_queue set status = 'CANCELED' where id = ?", question);
                    canceled.countDown();
                    await(commit);
                }));
            assertThat(canceled.await(10, TimeUnit.SECONDS)).isTrue();

            // when: 일괄 응답이 락을 기다리는 동안 다른 응답이 커밋한다
            Future<BulkAnswerResult> bulk = threads.submit(() ->
                answerService.bulkAnswer(USER_ID, batchId, "용도", "업무미팅"));
            UserLockOrder.awaitLockWaiter(jdbcTemplate);
            commit.countDown();
            other.get(10, TimeUnit.SECONDS);

            // then: 취소가 반영된 대기 질문을 읽어 답할 대상이 없다
            assertThat(bulk.get(10, TimeUnit.SECONDS).answeredCount()).isZero();
        } finally {
            commit.countDown();
            threads.shutdownNow();
        }
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from user_fact where batch_id = ?", Integer.class, batchId)).isZero();
    }

    @Test
    void answer_takes_the_user_lock_before_the_transaction_lock() throws Exception {
        UUID cafe = insertTransaction("카페", "스타벅스");
        judge(cafe);
        UUID question = pendingQuestion(cafe, "용도");

        UserLockOrder.assertTakesUserLockFirst(jdbcTemplate, transactionManager, USER_ID,
            UserLockOrder.TRANSACTION_ROW, cafe,
            () -> answerService.answer(USER_ID, List.of(question), "업무미팅", AnswerSource.USER));
    }

    @Test
    void bulk_answer_takes_the_user_lock_before_the_transaction_lock() throws Exception {
        UUID cafe = insertTransaction("카페", "스타벅스");
        judge(cafe);

        UserLockOrder.assertTakesUserLockFirst(jdbcTemplate, transactionManager, USER_ID,
            UserLockOrder.TRANSACTION_ROW, cafe,
            () -> answerService.bulkAnswer(USER_ID, batchId, "용도", "업무미팅"));
    }

    @Test
    void invalid_bulk_answers_change_nothing() throws Exception {
        // given: 카페(용도: 업무미팅·개인·혼자작업)
        UUID cafe = insertTransaction("카페", "스타벅스");
        judge(cafe);

        // when / then
        bulkAnswer(UUID.randomUUID(), "용도", "개인")
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("BATCH_NOT_FOUND"));
        bulkAnswer(batchId, "자산여부", "개인")
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("UNKNOWN_FACT_TYPE"));
        bulkAnswer(batchId, "용도", "전용")
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("INVALID_ANSWER_VALUE"));
        mockMvc.perform(post("/api/v1/questions/bulk-answer")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"batchId": "%s", "factType": "용도"}
                    """.formatted(batchId)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        // then
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from user_fact where batch_id = ?", Integer.class, batchId)).isZero();
        assertThat(pendingQuestion(cafe, "용도")).isNotNull();
    }

    @Test
    void export_lists_current_judgments_with_answers_and_the_yearly_limit_excess() throws Exception {
        // given: 통신(전용) 가능, 카페 업무미팅 접대비(한도 인정액을 결제금액보다 작게 두어 그해 한도를 넘긴다), 답하지 않은 카페
        // 한도는 사용자의 한 해 전체라, 같은 사용자를 쓰는 다른 테스트와 겹치지 않는 해(평일)에 둔다
        UUID telecom = insertTransaction("통신", "KT");
        UUID meeting = insertTransaction("카페", "스타벅스", 6_500L, "2031-03-04");
        UUID unanswered = insertTransaction("카페", "이디야");
        List.of(telecom, meeting, unanswered).forEach(this::judge);
        answer(List.of(pendingQuestion(telecom, "전용여부")), "전용").andExpect(status().isOk());
        answer(List.of(pendingQuestion(meeting, "용도")), "업무미팅").andExpect(status().isOk());
        jdbcTemplate.update("""
            update limit_bucket_entry set allowed_amount = 3000
            where judgment_id = (select id from judgment where transaction_id = ? order by revision desc limit 1)
            """, meeting);

        // when / then: 거래마다 현재 판정 하나, 답한 질문과 답. 한도를 넘은 해의 접대비는 인정액을 비우고 초과액은 limits 에 둔다
        mockMvc.perform(get("/api/v1/judgments/export").param("batchId", batchId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(3))
            .andExpect(jsonPath("$.items[?(@.judgment.transactionId == '%s' && @.allowedAmount == null)]", meeting)
                .exists())
            .andExpect(jsonPath("$.limits.length()").value(1))
            .andExpect(jsonPath("$.limits[0].bucket").value("접대비"))
            .andExpect(jsonPath("$.limits[0].totalAmount").value(6500))
            .andExpect(jsonPath("$.limits[0].excessAmount").value(3500))
            .andExpect(jsonPath("$.items[?(@.judgment.transactionId == '%s')].judgment.finalAmount", meeting)
                .value(6500))
            .andExpect(jsonPath("$.items[?(@.judgment.transactionId == '%s')].answers[0].answer", meeting)
                .value("업무미팅"))
            .andExpect(jsonPath("$.items[?(@.judgment.transactionId == '%s')].answers[0].question", meeting)
                .isNotEmpty())
            .andExpect(jsonPath("$.items[?(@.judgment.transactionId == '%s')].allowedAmount", telecom).value(6500))
            .andExpect(jsonPath("$.items[?(@.judgment.transactionId == '%s')].answers[0].answer", telecom)
                .value("전용"))
            .andExpect(jsonPath("$.items[?(@.judgment.transactionId == '%s' && @.answers size 0)]", unanswered)
                .exists());
    }

    @Test
    void batch_summary_adds_entertainment_before_the_limit_and_gives_the_yearly_excess() throws Exception {
        // given: 업무미팅 접대비 6,500원, 한도 인정액을 3,000원으로 두어 그해(다른 테스트와 겹치지 않는 해) 한도를 넘긴다
        UUID meeting = insertTransaction("카페", "스타벅스", 6_500L, "2032-03-02");
        judge(meeting);
        answer(List.of(pendingQuestion(meeting, "용도")), "업무미팅").andExpect(status().isOk());
        jdbcTemplate.update("""
            update limit_bucket_entry set allowed_amount = 3000
            where judgment_id = (select id from judgment where transaction_id = ? order by revision desc limit 1)
            """, meeting);

        // when / then: batch 몫은 순서 없이 나눌 수 없어 한도 전 금액으로 더하고, 초과액은 limits 로 따로 준다
        mockMvc.perform(get("/api/v1/judgments/summary").param("batchId", batchId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.byVerdict.AVAILABLE.finalAmount").value(6500))
            .andExpect(jsonPath("$.limits.length()").value(1))
            .andExpect(jsonPath("$.limits[0].taxYear").value(2032))
            .andExpect(jsonPath("$.limits[0].totalAmount").value(6500))
            .andExpect(jsonPath("$.limits[0].excessAmount").value(3500));
    }

    @Test
    void export_needs_exactly_one_of_batch_id_and_year() throws Exception {
        mockMvc.perform(get("/api/v1/judgments/export"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_EXPORT_SCOPE"));
        mockMvc.perform(get("/api/v1/judgments/export").param("batchId", batchId.toString()).param("year", "2025"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_EXPORT_SCOPE"));
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
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

    private ResultActions bulkAnswer(UUID targetBatchId, String factType, String value) throws Exception {
        return mockMvc.perform(post("/api/v1/questions/bulk-answer")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"batchId": "%s", "factType": "%s", "answer": {"value": "%s"}}
                """.formatted(targetBatchId, factType, value)));
    }

    private void judge(UUID transactionId) {
        executor.judge(transactionId, context, new JudgmentOrigin(JudgmentOriginType.RUN, runId));
    }

    private UUID latestJudgment(UUID transactionId) {
        return jdbcTemplate.queryForObject(
            "select id from judgment where transaction_id = ? order by revision desc limit 1", UUID.class, transactionId);
    }

    private UUID currentJudgment(UUID transactionId) {
        return jdbcTemplate.queryForObject(
            "select current_judgment_id from transaction where id = ?", UUID.class, transactionId);
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
        return insertTransaction(category, merchantNorm, amount, "2025-10-08");
    }

    private UUID insertTransaction(String category, String merchantNorm, long amount, String approvedAt) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, ?::date, ?, ?, ?, ?, ?, 'JUDGEABLE', 'AUTO', 'CLASSIFIED')
            """, id, batchId, USER_ID, approvedAt, merchantNorm, merchantNorm, category, amount, id.toString());
        return id;
    }
}
