package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.shared.auth.TemporaryCurrentUserProvider;
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
 * 판정 조회 (api.md 3.7, §5). 판정은 표에 직접 넣는다. 요청은 임시 사용자로 간다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class JudgmentQueryIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final UUID USER_ID = TemporaryCurrentUserProvider.TEMPORARY_USER_ID;

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
    void detail_returns_judgment_with_transaction_summary_and_citations() throws Exception {
        // given
        UUID transactionId = insertTransaction(batchId, "2025-10-08", "JUDGEABLE", "AUTO");
        UUID judgmentId = insertJudgment(transactionId, 1, "AVAILABLE", "run_id", runId, "2025-10-09T10:00:00+09:00");
        long statuteVersionId = insertStatute("소득세법-27-1");
        jdbcTemplate.update("insert into judgment_citation(judgment_id, statute_version_id) values (?, ?)",
            judgmentId, statuteVersionId);

        // when / then
        mockMvc.perform(get("/api/v1/judgments/{id}", judgmentId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(judgmentId.toString()))
            .andExpect(jsonPath("$.transactionId").value(transactionId.toString()))
            .andExpect(jsonPath("$.transaction.merchantRaw").value("스타벅스 서면점"))
            .andExpect(jsonPath("$.transaction.amount").value(6500))
            .andExpect(jsonPath("$.revision").value(1))
            .andExpect(jsonPath("$.origin.type").value("RUN"))
            .andExpect(jsonPath("$.origin.id").value(runId.toString()))
            .andExpect(jsonPath("$.verdict.code").value("AVAILABLE"))
            .andExpect(jsonPath("$.verdict.label").value("가능"))
            .andExpect(jsonPath("$.ruleCardId").value("R-300"))
            .andExpect(jsonPath("$.appliedRuleIds[0]").value("R-300"))
            .andExpect(jsonPath("$.computedAt").value("2025-10-09T01:00:00Z"))
            .andExpect(jsonPath("$.citations[0].statuteVersionId").value(statuteVersionId))
            .andExpect(jsonPath("$.citations[0].statuteId").value("소득세법-27-1"));
    }

    @Test
    void detail_of_another_users_judgment_is_not_found() throws Exception {
        // given: 다른 사용자의 거래에 붙은 판정
        UUID otherBatchId = insertBatch(insertUser());
        UUID transactionId = insertTransaction(otherBatchId, "2025-10-08", "JUDGEABLE", "AUTO");
        UUID judgmentId = insertJudgment(transactionId, 1, "AVAILABLE", "run_id", insertRun(otherBatchId),
            "2025-10-09T10:00:00+09:00");

        // when / then
        mockMvc.perform(get("/api/v1/judgments/{id}", judgmentId))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("JUDGMENT_NOT_FOUND"));
    }

    @Test
    void batch_list_returns_latest_revision_of_each_current_transaction() throws Exception {
        // given: 두 번 판정한 거래, 사용자가 제외한 거래, 분류 확인을 기다리는 거래, 같은 사용자의 다른 batch 거래
        UUID judged = insertTransaction(batchId, "2025-10-08", "JUDGEABLE", "AUTO");
        insertJudgment(judged, 1, "NEEDS_REVIEW", "run_id", runId, "2025-10-09T10:00:00+09:00");
        UUID latest = insertJudgment(judged, 2, "AVAILABLE", "run_id", insertRun(batchId),
            "2025-10-10T10:00:00+09:00");
        UUID excluded = insertTransaction(batchId, "2025-10-08", "JUDGEABLE", "EXCLUDED");
        insertJudgment(excluded, 1, "AVAILABLE", "run_id", runId, "2025-10-09T10:00:00+09:00");
        UUID unclassified = insertTransaction(batchId, "2025-10-08", "JUDGEABLE", "AUTO");
        insertJudgment(unclassified, 1, "AVAILABLE", "run_id", runId, "2025-10-09T10:00:00+09:00");
        jdbcTemplate.update("update transaction set classification_status = 'NEEDS_REVIEW' where id = ?", unclassified);
        UUID otherBatchId = insertBatch(USER_ID);
        UUID otherBatchTransaction = insertTransaction(otherBatchId, "2025-10-08", "JUDGEABLE", "AUTO");
        insertJudgment(otherBatchTransaction, 1, "AVAILABLE", "run_id", insertRun(otherBatchId),
            "2025-10-09T10:00:00+09:00");

        // when / then
        mockMvc.perform(get("/api/v1/judgments").param("batchId", batchId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[*].id", contains(latest.toString())))
            .andExpect(jsonPath("$.page.totalElements").value(1));
    }

    @Test
    void active_override_is_current_even_if_a_later_automatic_revision_exists() throws Exception {
        // given: 수정한 뒤 다시 판정한 거래, 수정을 해제한 거래
        UUID overridden = insertTransaction(batchId, "2025-10-08", "JUDGEABLE", "AUTO");
        UUID first = insertJudgment(overridden, 1, "NEEDS_REVIEW", "run_id", runId, "2025-10-09T10:00:00+09:00");
        UUID overrideId = insertOverride(overridden, first, true);
        UUID overrideRevision = insertJudgment(overridden, 2, "UNAVAILABLE", "judgment_override_id", overrideId,
            "2025-10-10T10:00:00+09:00");
        insertJudgment(overridden, 3, "AVAILABLE", "run_id", insertRun(batchId), "2025-10-11T10:00:00+09:00");

        UUID released = insertTransaction(batchId, "2025-10-08", "JUDGEABLE", "AUTO");
        UUID automatic = insertJudgment(released, 1, "NEEDS_REVIEW", "run_id", runId, "2025-10-09T09:00:00+09:00");
        UUID releasedOverrideId = insertOverride(released, automatic, false);
        insertJudgment(released, 2, "AVAILABLE", "judgment_override_id", releasedOverrideId,
            "2025-10-10T09:00:00+09:00");

        // when / then
        mockMvc.perform(get("/api/v1/judgments").param("batchId", batchId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[*].id", contains(overrideRevision.toString(), automatic.toString())));
    }

    @Test
    void run_list_returns_only_judgments_the_run_created() throws Exception {
        // given: run 뒤에 다시 판정한 거래, run 뒤에 사용자가 제외한 거래, 다른 run 만 판정한 거래
        UUID rejudged = insertTransaction(batchId, "2025-10-08", "JUDGEABLE", "AUTO");
        UUID byRun = insertJudgment(rejudged, 1, "NEEDS_REVIEW", "run_id", runId, "2025-10-09T10:00:00+09:00");
        UUID laterRunId = insertRun(batchId);
        insertJudgment(rejudged, 2, "AVAILABLE", "run_id", laterRunId, "2025-10-10T10:00:00+09:00");
        UUID excludedLater = insertTransaction(batchId, "2025-10-08", "JUDGEABLE", "EXCLUDED");
        UUID excludedByRun = insertJudgment(excludedLater, 1, "AVAILABLE", "run_id", runId,
            "2025-10-09T09:00:00+09:00");
        UUID otherRunOnly = insertTransaction(batchId, "2025-10-08", "JUDGEABLE", "AUTO");
        insertJudgment(otherRunOnly, 1, "AVAILABLE", "run_id", laterRunId, "2025-10-10T09:00:00+09:00");

        // when / then: 현재 판정이 아니어도, 지금 제외된 거래여도 그 run 의 결과다
        mockMvc.perform(get("/api/v1/judgments").param("runId", runId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[*].id", contains(byRun.toString(), excludedByRun.toString())));
    }

    @Test
    void transaction_history_returns_every_revision_newest_first() throws Exception {
        // given: 수정까지 거친 거래
        UUID transactionId = insertTransaction(batchId, "2025-10-08", "JUDGEABLE", "AUTO");
        UUID first = insertJudgment(transactionId, 1, "NEEDS_REVIEW", "run_id", runId, "2025-10-09T10:00:00+09:00");
        UUID overrideId = insertOverride(transactionId, first, true);
        UUID second = insertJudgment(transactionId, 2, "UNAVAILABLE", "judgment_override_id", overrideId,
            "2025-10-10T10:00:00+09:00");
        UUID third = insertJudgment(transactionId, 3, "AVAILABLE", "run_id", insertRun(batchId),
            "2025-10-11T10:00:00+09:00");

        // when / then
        mockMvc.perform(get("/api/v1/judgments")
                .param("transactionId", transactionId.toString())
                .param("latestOnly", "false"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[*].id", contains(third.toString(), second.toString(), first.toString())));
    }

    @Test
    void year_and_verdict_narrow_current_judgments() throws Exception {
        // given: 다른 테스트 데이터와 겹치지 않는 연도의 거래 셋
        UUID matching = insertTransaction(batchId, "2031-03-01", "JUDGEABLE", "AUTO");
        UUID matchingJudgment = insertJudgment(matching, 1, "AVAILABLE", "run_id", runId,
            "2031-03-02T10:00:00+09:00");
        UUID otherVerdict = insertTransaction(batchId, "2031-03-01", "JUDGEABLE", "AUTO");
        insertJudgment(otherVerdict, 1, "UNAVAILABLE", "run_id", runId, "2031-03-02T10:00:00+09:00");
        UUID nextYear = insertTransaction(batchId, "2032-01-01", "JUDGEABLE", "AUTO");
        insertJudgment(nextYear, 1, "AVAILABLE", "run_id", runId, "2032-01-02T10:00:00+09:00");

        // when / then
        mockMvc.perform(get("/api/v1/judgments").param("year", "2031").param("verdict", "AVAILABLE"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[*].id", contains(matchingJudgment.toString())));
    }

    @Test
    void list_never_returns_another_users_judgments() throws Exception {
        // given: 다른 사용자의 run 과 판정
        UUID otherBatchId = insertBatch(insertUser());
        UUID otherRunId = insertRun(otherBatchId);
        UUID transactionId = insertTransaction(otherBatchId, "2033-01-01", "JUDGEABLE", "AUTO");
        insertJudgment(transactionId, 1, "AVAILABLE", "run_id", otherRunId, "2033-01-02T10:00:00+09:00");

        // when / then: run·거래·연도 어느 조건으로도 보이지 않는다
        mockMvc.perform(get("/api/v1/judgments").param("runId", otherRunId.toString()))
            .andExpect(jsonPath("$.items").isEmpty());
        mockMvc.perform(get("/api/v1/judgments").param("transactionId", transactionId.toString()))
            .andExpect(jsonPath("$.items").isEmpty());
        mockMvc.perform(get("/api/v1/judgments").param("year", "2033"))
            .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void summary_counts_current_judgments_of_batch_and_judgments_created_by_run() throws Exception {
        // given: run 뒤에 다시 판정한 거래, run 뒤에 사용자가 제외한 거래
        UUID rejudged = insertTransaction(batchId, "2025-10-08", "JUDGEABLE", "AUTO");
        insertJudgment(rejudged, 1, "NEEDS_REVIEW", "run_id", runId, "2025-10-09T10:00:00+09:00");
        UUID latest = insertJudgment(rejudged, 2, "AVAILABLE", "run_id", insertRun(batchId),
            "2025-10-10T10:00:00+09:00");
        jdbcTemplate.update("update judgment set account = '소모품비' where id = ?", latest);
        UUID excludedLater = insertTransaction(batchId, "2025-10-08", "JUDGEABLE", "EXCLUDED");
        insertJudgment(excludedLater, 1, "UNAVAILABLE", "run_id", runId, "2025-10-09T10:00:00+09:00");

        // when / then: batch 는 현재 판정(제외 거래 빼고)만 센다
        mockMvc.perform(get("/api/v1/judgments/summary").param("batchId", batchId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.scope.type").value("BATCH"))
            .andExpect(jsonPath("$.scope.id").value(batchId.toString()))
            .andExpect(jsonPath("$.totalCount").value(1))
            .andExpect(jsonPath("$.byVerdict.AVAILABLE.count").value(1))
            .andExpect(jsonPath("$.byVerdict.NEEDS_REVIEW.count").value(0))
            .andExpect(jsonPath("$.byAccount[0].account").value("소모품비"));

        // when / then: run 은 그 run 이 만든 판정을 그대로 센다
        mockMvc.perform(get("/api/v1/judgments/summary").param("runId", runId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.scope.type").value("RUN"))
            .andExpect(jsonPath("$.totalCount").value(2))
            .andExpect(jsonPath("$.byVerdict.NEEDS_REVIEW.count").value(1))
            .andExpect(jsonPath("$.byVerdict.UNAVAILABLE.count").value(1))
            .andExpect(jsonPath("$.byAccount").isEmpty());
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

    private UUID insertTransaction(UUID transactionBatchId, String approvedAt, String sourceStatus,
        String userInclusion) {
        UUID ownerId = jdbcTemplate.queryForObject(
            "select user_id from upload_batch where id = ?", UUID.class, transactionBatchId);
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, ?::date, '스타벅스 서면점', '스타벅스', '카페', 6500, ?, ?, ?, 'CLASSIFIED')
            """, id, transactionBatchId, ownerId, approvedAt, id.toString(), sourceStatus, userInclusion);
        return id;
    }

    /** originColumn 은 run_id·judgment_override_id 등 origin FK 컬럼 이름이다. */
    private UUID insertJudgment(UUID transactionId, int revision, String verdict, String originColumn,
        UUID originId, String computedAt) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment(
                id, transaction_id, revision, rule_card_id, rule_card_version, applied_rule_ids,
                rules_commit_sha, user_context_version, tax_year, verdict, is_inference, computed_at, %s
            ) values (?, ?, ?, 'R-300', 1, '["R-300"]', 'fixture', 1, 2025, ?, false, ?::timestamptz, ?)
            """.formatted(originColumn), id, transactionId, revision, verdict, computedAt, originId);
        return id;
    }

    private UUID insertOverride(UUID transactionId, UUID sourceJudgmentId, boolean active) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment_override(id, transaction_id, source_judgment_id, to_verdict, active, released_at)
            values (?, ?, ?, 'UNAVAILABLE', ?, case when ? then null else now() end)
            """, id, transactionId, sourceJudgmentId, active, active);
        return id;
    }

    private long insertStatute(String statuteId) {
        return jdbcTemplate.queryForObject("""
            insert into statute_version(
                statute_id, doc_type, hierarchy, effective_from, body, body_hash,
                doc_id, unit_level, title, source_url
            ) values (?, '법령', '법률', '2024-01-01', '원문', 'hash', 'DOC', '항', ?, 'https://law.go.kr/test')
            returning id
            """, Long.class, statuteId, statuteId);
    }
}
