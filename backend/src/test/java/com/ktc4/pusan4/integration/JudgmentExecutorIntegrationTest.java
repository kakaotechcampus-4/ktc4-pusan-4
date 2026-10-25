package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.judgment.domain.JudgmentOrigin;
import com.ktc4.pusan4.judgment.domain.JudgmentOriginType;
import com.ktc4.pusan4.judgment.domain.UserFact;
import com.ktc4.pusan4.judgment.persistence.JudgmentExecutor;
import com.ktc4.pusan4.judgment.persistence.UserFactPersistenceService;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.user.domain.BusinessContext;
import com.ktc4.pusan4.user.persistence.BusinessContextService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 판정 실행기: 실제 규칙 카드(../rules)로 거래 한 건을 판정해 저장한다.
 * 카페(940909) 거래를 쓴다. 평일이면 R-300(확인필요, 용도 질문), 휴일이면 R-312(불가)다.
 */
@SpringBootTest(properties = "app.rules.commit-sha=test-sha")
@Testcontainers
class JudgmentExecutorIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JudgmentExecutor executor;

    @Autowired
    private BusinessContextService contextService;

    @Autowired
    private UserFactPersistenceService userFactService;

    private UUID userId;
    private UUID batchId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        batchId = UUID.randomUUID();
        jdbcTemplate.update("insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com");
        jdbcTemplate.update("""
            insert into upload_batch(id, user_id, source_type, card_issuer, period_start, period_end, file_hash)
            values (?, ?, '승인내역', '국민', '2025-01-01', '2025-12-31', ?)
            """, batchId, userId, batchId.toString());
        insertContext(1);
        for (String statuteId : List.of("소득세법-33-1-5", "소득세법시행령-61-1-1", "소득세법-35-1")) {
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
    void judges_and_saves_revision_with_origin_context_version_and_question() {
        UUID transactionId = insertCafeTransaction("2025-10-08");
        UUID runId = insertRun();

        UUID judgmentId = executor.judge(transactionId, contextService.version(userId, 1), runOrigin(runId));

        assertThat(jdbcTemplate.queryForMap("""
            select verdict, rule_card_id, run_id, user_context_version, rules_commit_sha, tax_year
            from judgment where id = ?
            """, judgmentId))
            .containsEntry("verdict", "NEEDS_REVIEW")
            .containsEntry("rule_card_id", "R-300")
            .containsEntry("run_id", runId)
            .containsEntry("user_context_version", 1)
            .containsEntry("rules_commit_sha", "test-sha")
            .containsEntry("tax_year", 2025);
        assertThat(jdbcTemplate.queryForList(
            "select status from question_queue where judgment_id = ?", String.class, judgmentId
        )).containsExactly("PENDING");
    }

    @Test
    void public_holiday_from_table_switches_to_holiday_card_and_cancels_old_question() {
        UUID transactionId = insertCafeTransaction("2025-10-09");
        UUID runId = insertRun();
        BusinessContext context = contextService.version(userId, 1);

        UUID weekdayJudgmentId = executor.judge(transactionId, context, runOrigin(runId));
        jdbcTemplate.update("insert into public_holiday(holiday_date, name) values ('2025-10-09', '한글날')");
        UUID holidayJudgmentId = executor.judge(transactionId, context, runOrigin(runId));

        assertThat(jdbcTemplate.queryForObject(
            "select rule_card_id from judgment where id = ?", String.class, weekdayJudgmentId
        )).isEqualTo("R-300");
        assertThat(jdbcTemplate.queryForMap(
            "select verdict, rule_card_id, revision from judgment where id = ?", holidayJudgmentId
        ))
            .containsEntry("verdict", "UNAVAILABLE")
            .containsEntry("rule_card_id", "R-312")
            .containsEntry("revision", 2);
        assertThat(jdbcTemplate.queryForList(
            "select status from question_queue where judgment_id = ?", String.class, weekdayJudgmentId
        )).containsExactly("CANCELED");
        assertThat(jdbcTemplate.queryForList(
            "select status from question_queue where judgment_id = ?", String.class, holidayJudgmentId
        )).containsExactly("PENDING");
    }

    @Test
    void uses_only_facts_of_the_transactions_batch() {
        UUID transactionId = insertCafeTransaction("2025-10-08");
        UUID otherBatchId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into upload_batch(id, user_id, source_type, card_issuer, period_start, period_end, file_hash)
            values (?, ?, '승인내역', '국민', '2025-01-01', '2025-12-31', ?)
            """, otherBatchId, userId, otherBatchId.toString());
        UserFact businessMeeting = new UserFact(
            "transaction:" + transactionId, "용도", Map.of("value", "업무미팅")
        );
        userFactService.save(userId, otherBatchId, businessMeeting);
        BusinessContext context = contextService.version(userId, 1);

        UUID withoutFactId = executor.judge(transactionId, context, runOrigin(insertRun()));
        UUID factId = userFactService.save(userId, batchId, businessMeeting);
        UUID withFactId = executor.judge(
            transactionId, context, new JudgmentOrigin(JudgmentOriginType.USER_FACT, factId)
        );

        assertThat(jdbcTemplate.queryForObject(
            "select verdict from judgment where id = ?", String.class, withoutFactId
        )).isEqualTo("NEEDS_REVIEW");
        assertThat(jdbcTemplate.queryForMap(
            "select verdict, account, trigger_user_fact_id from judgment where id = ?", withFactId
        ))
            .containsEntry("verdict", "AVAILABLE")
            .containsEntry("account", "접대비")
            .containsEntry("trigger_user_fact_id", factId);
    }

    @Test
    void rejudge_uses_the_requested_context_version() {
        UUID transactionId = insertCafeTransaction("2025-10-08");
        insertContext(2);
        UUID runId = insertRun();

        executor.rejudge(userId, List.of(transactionId), runOrigin(runId), 1);

        assertThat(jdbcTemplate.queryForObject(
            "select user_context_version from judgment where transaction_id = ?", Integer.class, transactionId
        )).isEqualTo(1);
        assertThatThrownBy(() -> executor.rejudge(userId, List.of(transactionId), runOrigin(runId), 9))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("9");
    }

    @Test
    void missing_statute_fails_the_judgment_and_saves_nothing() {
        // 도서 카드(R-940909202)는 §27① 을 인용하는데, 이 테스트는 그 조문을 넣지 않았다.
        UUID transactionId = insertTransaction("2025-10-08", "교보문고", "도서");

        assertThatThrownBy(() ->
            executor.judge(transactionId, contextService.version(userId, 1), runOrigin(insertRun()))
        ).isInstanceOf(IllegalStateException.class);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from judgment where transaction_id = ?", Integer.class, transactionId
        )).isZero();
    }

    @Test
    void rejects_context_of_another_user() {
        UUID transactionId = insertCafeTransaction("2025-10-08");
        UUID otherUserId = UUID.randomUUID();
        jdbcTemplate.update(
            "insert into app_user(id, email) values (?, ?)", otherUserId, otherUserId + "@example.com"
        );
        insertContext(otherUserId, 1);

        assertThatThrownBy(() ->
            executor.judge(transactionId, contextService.version(otherUserId, 1), runOrigin(insertRun()))
        ).isInstanceOf(IllegalArgumentException.class);
    }

    private UUID insertCafeTransaction(String approvedAt) {
        return insertTransaction(approvedAt, "스타벅스", "카페");
    }

    private UUID insertTransaction(String approvedAt, String merchant, String category) {
        UUID transactionId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm,
                merchant_category, amount, natural_key, source_status, classification_status
            ) values (?, ?, ?, ?::date, ?, ?, ?, 6500, ?, 'JUDGEABLE', 'CLASSIFIED')
            """, transactionId, batchId, userId, approvedAt, merchant, merchant, category, transactionId.toString());
        return transactionId;
    }

    private void insertContext(int version) {
        insertContext(userId, version);
    }

    private void insertContext(UUID ownerId, int version) {
        jdbcTemplate.update("""
            insert into user_context(
                id, user_id, industry_code, prev_year_revenue, business_open_date,
                bookkeeping_duty, has_employee, version
            ) values (?, ?, '940909', 30000000, '2023-01-01', '간편장부', false, ?)
            """, UUID.randomUUID(), ownerId, version);
    }

    private UUID insertRun() {
        UUID runId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment_run(id, batch_id, context_id, context_version, status)
            select ?, ?, id, version, 'RUNNING' from user_context where user_id = ? and version = 1
            """, runId, batchId, userId);
        return runId;
    }

    private static JudgmentOrigin runOrigin(UUID runId) {
        return new JudgmentOrigin(JudgmentOriginType.RUN, runId);
    }
}
