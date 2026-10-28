package com.ktc4.pusan4.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ktc4.pusan4.shared.api.MockFixtures;
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

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 사용자 판정 수정과 해제 (api.md 3.8). 에러는 #62 논의에서 FE 목업이 따르는 쪽이다.
 * 판정은 표에 직접 넣는다. 요청은 임시 사용자로 간다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class JudgmentOverrideIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final UUID USER_ID = MockFixtures.USER_ID;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private UUID batchId;
    private UUID runId;

    @BeforeEach
    void setUp() {
        batchId = insertBatch(USER_ID);
        runId = insertRun(batchId);
    }

    @Test
    void override_makes_new_revision_with_only_verdict_changed() throws Exception {
        // given: 계정과목과 인용이 붙은 자동 판정
        UUID transactionId = insertTransaction(batchId, "JUDGEABLE", "AUTO");
        UUID source = insertJudgment(transactionId, 1, "AVAILABLE", "run_id", runId);
        jdbcTemplate.update("update judgment set account = '소모품비' where id = ?", source);
        long statuteVersionId = insertStatute("소득세법-27-1");
        jdbcTemplate.update("insert into judgment_citation(judgment_id, statute_version_id) values (?, ?)",
            source, statuteVersionId);

        // when
        String body = override(source, "UNAVAILABLE", "개인적으로 사용한 비용입니다.")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.transactionId").value(transactionId.toString()))
            .andExpect(jsonPath("$.revision").value(2))
            .andExpect(jsonPath("$.origin.type").value("OVERRIDE"))
            .andExpect(jsonPath("$.verdict.code").value("UNAVAILABLE"))
            .andExpect(jsonPath("$.account").value("소모품비"))
            .andExpect(jsonPath("$.ruleCardId").value("R-300"))
            .andExpect(jsonPath("$.computedAt").isNotEmpty())
            .andExpect(jsonPath("$.citations[0].statuteVersionId").value(statuteVersionId))
            .andReturn().getResponse().getContentAsString();

        // then: 원래 판정은 그대로, 수정 기록이 남고, 현재 판정은 수정 revision 이다
        UUID revision = UUID.fromString(objectMapper.readTree(body).path("id").asText());
        UUID overrideId = UUID.fromString(objectMapper.readTree(body).path("origin").path("id").asText());
        Map<String, Object> saved = jdbcTemplate.queryForMap(
            "select source_judgment_id, to_verdict, reason, active from judgment_override where id = ?", overrideId);
        assertThat(saved).containsEntry("source_judgment_id", source)
            .containsEntry("to_verdict", "UNAVAILABLE")
            .containsEntry("reason", "개인적으로 사용한 비용입니다.")
            .containsEntry("active", true);
        assertThat(jdbcTemplate.queryForObject("select verdict from judgment where id = ?", String.class, source))
            .isEqualTo("AVAILABLE");
        assertCurrent(revision);
    }

    @Test
    void override_of_out_of_scope_needs_review_drops_the_out_of_scope_flag() throws Exception {
        // given: 대상 밖 표시가 붙은 확인 필요. 대상 밖 표시는 확인 필요에만 붙는다
        UUID transactionId = insertTransaction(batchId, "JUDGEABLE", "AUTO");
        UUID source = insertJudgment(transactionId, 1, "NEEDS_REVIEW", "run_id", runId);
        jdbcTemplate.update("update judgment set is_out_of_scope = true where id = ?", source);

        // when / then
        override(source, "AVAILABLE", null)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.verdict.code").value("AVAILABLE"))
            .andExpect(jsonPath("$.outOfScope").value(false));
    }

    @Test
    void second_override_releases_the_first() throws Exception {
        // given: 한 번 수정한 거래
        UUID transactionId = insertTransaction(batchId, "JUDGEABLE", "AUTO");
        UUID source = insertJudgment(transactionId, 1, "NEEDS_REVIEW", "run_id", runId);
        UUID firstRevision = idOf(override(source, "UNAVAILABLE", null));

        // when: 지금 판정(수정 revision)을 다시 수정한다
        UUID secondRevision = idOf(override(firstRevision, "AVAILABLE", null));

        // then: 활성 수정은 하나, 처음 수정은 해제 시각이 남는다
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from judgment_override where transaction_id = ? and active", Integer.class, transactionId))
            .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("""
            select released_at is not null from judgment_override
            where source_judgment_id = ? and not active
            """, Boolean.class, source)).isTrue();
        assertCurrent(secondRevision);
    }

    @Test
    void later_automatic_revision_does_not_replace_active_override() throws Exception {
        // given: 수정 뒤에 다시 판정된 거래
        UUID transactionId = insertTransaction(batchId, "JUDGEABLE", "AUTO");
        UUID source = insertJudgment(transactionId, 1, "NEEDS_REVIEW", "run_id", runId);
        UUID revision = idOf(override(source, "UNAVAILABLE", null));
        insertJudgment(transactionId, 3, "AVAILABLE", "run_id", insertRun(batchId));

        // when / then
        assertCurrent(revision);
    }

    @Test
    void release_falls_back_to_latest_automatic_revision_and_repeats_as_no_content() throws Exception {
        // given
        UUID transactionId = insertTransaction(batchId, "JUDGEABLE", "AUTO");
        UUID source = insertJudgment(transactionId, 1, "NEEDS_REVIEW", "run_id", runId);
        String body = override(source, "UNAVAILABLE", null).andReturn().getResponse().getContentAsString();
        UUID overrideId = UUID.fromString(objectMapper.readTree(body).path("origin").path("id").asText());

        // when / then: 해제하면 수정 전 자동 판정이 현재 판정이고, 다시 해제해도 204 다
        mockMvc.perform(delete("/api/v1/judgment-overrides/{id}", overrideId))
            .andExpect(status().isNoContent());
        assertCurrent(source);
        mockMvc.perform(delete("/api/v1/judgment-overrides/{id}", overrideId))
            .andExpect(status().isNoContent());
        assertThat(jdbcTemplate.queryForObject(
            "select active from judgment_override where id = ?", Boolean.class, overrideId)).isFalse();
    }

    @Test
    void release_of_missing_or_another_users_override_is_not_found() throws Exception {
        // given: 다른 사용자의 수정
        UUID otherBatchId = insertBatch(insertUser());
        UUID transactionId = insertTransaction(otherBatchId, "JUDGEABLE", "AUTO");
        UUID source = insertJudgment(transactionId, 1, "NEEDS_REVIEW", "run_id", insertRun(otherBatchId));
        UUID othersOverride = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment_override(id, transaction_id, source_judgment_id, to_verdict)
            values (?, ?, ?, 'UNAVAILABLE')
            """, othersOverride, transactionId, source);

        // when / then
        for (UUID overrideId : new UUID[] {othersOverride, UUID.randomUUID()}) {
            mockMvc.perform(delete("/api/v1/judgment-overrides/{id}", overrideId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("JUDGMENT_OVERRIDE_NOT_FOUND"));
        }
    }

    @Test
    void override_to_needs_review_is_unprocessable() throws Exception {
        UUID transactionId = insertTransaction(batchId, "JUDGEABLE", "AUTO");
        UUID source = insertJudgment(transactionId, 1, "AVAILABLE", "run_id", runId);

        override(source, "NEEDS_REVIEW", null)
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("UNPROCESSABLE_ENTITY"));
    }

    @Test
    void override_of_a_judgment_that_is_not_current_conflicts() throws Exception {
        // given: 다시 판정되어 지난 revision 이 된 판정
        UUID transactionId = insertTransaction(batchId, "JUDGEABLE", "AUTO");
        UUID old = insertJudgment(transactionId, 1, "NEEDS_REVIEW", "run_id", runId);
        insertJudgment(transactionId, 2, "AVAILABLE", "run_id", insertRun(batchId));

        override(old, "UNAVAILABLE", null)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    @Test
    void override_of_a_transaction_out_of_judgment_targets_conflicts() throws Exception {
        // given: 사용자가 제외한 거래, 취소상계 거래
        for (String[] status : new String[][] {{"JUDGEABLE", "EXCLUDED"}, {"CANCELED_OFFSET", "AUTO"}}) {
            UUID transactionId = insertTransaction(batchId, status[0], status[1]);
            UUID judgment = insertJudgment(transactionId, 1, "AVAILABLE", "run_id", runId);

            override(judgment, "UNAVAILABLE", null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
        }
    }

    @Test
    void override_of_missing_or_another_users_judgment_is_not_found() throws Exception {
        UUID otherBatchId = insertBatch(insertUser());
        UUID transactionId = insertTransaction(otherBatchId, "JUDGEABLE", "AUTO");
        UUID others = insertJudgment(transactionId, 1, "AVAILABLE", "run_id", insertRun(otherBatchId));

        for (UUID judgmentId : new UUID[] {others, UUID.randomUUID()}) {
            override(judgmentId, "UNAVAILABLE", null)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("JUDGMENT_NOT_FOUND"));
        }
    }

    @Test
    void override_without_valid_verdict_is_a_validation_error() throws Exception {
        UUID transactionId = insertTransaction(batchId, "JUDGEABLE", "AUTO");
        UUID source = insertJudgment(transactionId, 1, "AVAILABLE", "run_id", runId);

        for (String body : new String[] {"{\"reason\": \"이유만\"}", "{\"toVerdict\": \"MAYBE\"}"}) {
            mockMvc.perform(post("/api/v1/judgments/{id}/override", source)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        }
    }

    private ResultActions override(UUID judgmentId, String toVerdict, String reason) throws Exception {
        return mockMvc.perform(post("/api/v1/judgments/{id}/override", judgmentId)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(reason == null
                ? Map.of("toVerdict", toVerdict)
                : Map.of("toVerdict", toVerdict, "reason", reason))));
    }

    private UUID idOf(ResultActions result) throws Exception {
        String body = result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(body).path("id").asText());
    }

    /** batch 결과에서 이 테스트의 거래 하나만 보지 않도록 거래별 현재 판정을 본다. */
    private void assertCurrent(UUID judgmentId) throws Exception {
        UUID transactionId = jdbcTemplate.queryForObject(
            "select transaction_id from judgment where id = ?", UUID.class, judgmentId);
        mockMvc.perform(get("/api/v1/judgments").param("transactionId", transactionId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[*].id", contains(judgmentId.toString())));
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

    private UUID insertTransaction(UUID transactionBatchId, String sourceStatus, String userInclusion) {
        UUID ownerId = jdbcTemplate.queryForObject(
            "select user_id from upload_batch where id = ?", UUID.class, transactionBatchId);
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, '2025-10-08', '스타벅스 서면점', '스타벅스', '카페', 6500, ?, ?, ?, 'CLASSIFIED')
            """, id, transactionBatchId, ownerId, id.toString(), sourceStatus, userInclusion);
        return id;
    }

    /** originColumn 은 run_id·judgment_override_id 등 origin FK 컬럼 이름이다. */
    private UUID insertJudgment(UUID transactionId, int revision, String verdict, String originColumn, UUID originId) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment(
                id, transaction_id, revision, rule_card_id, rule_card_version, applied_rule_ids,
                rules_commit_sha, user_context_version, tax_year, verdict, is_inference, %s
            ) values (?, ?, ?, 'R-300', 1, '["R-300"]', 'fixture', 1, 2025, ?, false, ?)
            """.formatted(originColumn), id, transactionId, revision, verdict, originId);
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
