package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.judgment.domain.JudgmentSummary;
import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.judgment.persistence.JudgmentOverrideService;
import com.ktc4.pusan4.judgment.persistence.JudgmentQueryService;
import com.ktc4.pusan4.judgment.persistence.LimitSettlementService;
import com.ktc4.pusan4.transaction.persistence.TransactionService;
import com.ktc4.pusan4.transaction.persistence.UploadBatchService;
import org.assertj.core.groups.Tuple;
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
import static org.assertj.core.api.Assertions.tuple;

/**
 * 접대비 한도 잠정 집계 (CONTEXT.md §4 집계 단계). 사용자의 현재 판정을 과세연도별로 모아 한도를 배분한다.
 */
@SpringBootTest
@Testcontainers
class LimitSettlementIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final String ENTERTAINMENT = "{\"limit_bucket\": \"접대비\"}";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private LimitSettlementService settlementService;

    @Autowired
    private JudgmentQueryService queryService;

    @Autowired
    private JudgmentOverrideService overrideService;

    @Autowired
    private TransactionService transactionService;

    @Autowired
    private UploadBatchService batchService;

    private UUID userId;
    private UUID batchId;
    private UUID runId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        batchId = UUID.randomUUID();
        jdbcTemplate.update("insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com");
        jdbcTemplate.update("""
            insert into upload_batch(id, user_id, source_type, card_issuer, period_start, period_end, file_hash)
            values (?, ?, '승인내역', '국민', '2024-01-01', '2025-12-31', ?)
            """, batchId, userId, batchId.toString());
        UUID contextId = UUID.randomUUID();
        // 직전연도 수입금액 3,000만원 → 한도 1,200만원 + 9만원 = 1,209만원
        jdbcTemplate.update("""
            insert into user_context(
                id, user_id, industry_code, prev_year_revenue, business_open_date,
                bookkeeping_duty, has_employee, version
            ) values (?, ?, '940909', 30000000, '2023-01-01', '간편장부', false, 1)
            """, contextId, userId);
        runId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment_run(id, batch_id, context_id, context_version, status, total_count)
            values (?, ?, ?, 1, 'COMPLETED', 0)
            """, runId, batchId, contextId);
    }

    @Test
    void allocates_the_annual_limit_per_tax_year_in_approval_order() {
        // given
        UUID january = judgment(transaction("2025-01-15", "AUTO"), "AVAILABLE", ENTERTAINMENT, 10_000_000L);
        UUID march = judgment(transaction("2025-03-02", "AUTO"), "AVAILABLE", ENTERTAINMENT, 5_000_000L);
        UUID lastYear = judgment(transaction("2024-12-20", "AUTO"), "AVAILABLE", ENTERTAINMENT, 50_000L);
        judgment(transaction("2025-02-01", "AUTO"), "AVAILABLE", "{}", 1_000_000L);
        judgment(transaction("2025-04-01", "AUTO"), "UNAVAILABLE", ENTERTAINMENT, 0L);
        judgment(transaction("2025-05-01", "EXCLUDED"), "AVAILABLE", ENTERTAINMENT, 300_000L);
        // 더 이상 접대비가 아닌 판정에 남은 2023년 항목
        UUID stale = judgment(transaction("2023-06-01", "AUTO"), "AVAILABLE", "{}", 70_000L);
        jdbcTemplate.update("""
            insert into limit_bucket_entry(user_id, tax_year, bucket_code, judgment_id, tagged_amount, allowed_amount, state)
            values (?, 2023, '접대비', ?, 70000, 70000, '잠정')
            """, userId, stale);

        // when
        settlementService.settleProvisional(userId);

        // then: 연도마다 승인일 순으로 한도를 채우고, 접대비가 아니거나 판정 대상이 아닌 거래는 빠진다
        List<Map<String, Object>> entries = jdbcTemplate.queryForList("""
            select judgment_id, tax_year, tagged_amount, allowed_amount, state
            from limit_bucket_entry where user_id = ? order by tax_year, tagged_amount desc
            """, userId);
        assertThat(entries)
            .extracting(row -> row.get("judgment_id"), row -> row.get("tax_year"),
                row -> row.get("tagged_amount"), row -> row.get("allowed_amount"), row -> row.get("state"))
            .containsExactly(
                tuple(lastYear, 2024, 50_000L, 50_000L, "잠정"),
                tuple(january, 2025, 10_000_000L, 10_000_000L, "잠정"),
                tuple(march, 2025, 5_000_000L, 2_090_000L, "잠정"));
    }

    @Test
    void refunds_do_not_enter_the_limit() {
        // 사용자가 포함시킨 승인취소처럼 금액이 음수인 거래가 접대비 가능으로 판정되어도 집계가 멈추지 않는다
        UUID meal = judgment(transaction("2025-03-02", "AUTO"), "AVAILABLE", ENTERTAINMENT, 6_500L);
        judgment(transaction("2025-03-03", "INCLUDED"), "AVAILABLE", ENTERTAINMENT, -6_500L);

        settlementService.settleProvisional(userId);

        assertThat(jdbcTemplate.queryForList(
            "select judgment_id from limit_bucket_entry where user_id = ?", UUID.class, userId))
            .containsExactly(meal);
    }

    @Test
    void override_and_its_release_settle_the_limit_again() {
        // given: 1월 1,000만원이 한도를 먼저 채워 3월은 209만원만 인정된다
        UUID january = judgment(transaction("2025-01-15", "AUTO"), "AVAILABLE", ENTERTAINMENT, 10_000_000L);
        judgment(transaction("2025-03-02", "AUTO"), "AVAILABLE", ENTERTAINMENT, 5_000_000L);
        settlementService.settleProvisional(userId);

        // when / then: 1월을 불가로 고치면 3월이 전액 인정되고, 수정을 풀면 되돌아온다
        overrideService.override(userId, january, Verdict.UNAVAILABLE, "개인 식사");
        assertThat(allowedByTagged()).containsExactly(tuple(5_000_000L, 5_000_000L));

        overrideService.release(userId, jdbcTemplate.queryForObject(
            "select id from judgment_override where source_judgment_id = ?", UUID.class, january));
        assertThat(allowedByTagged())
            .containsExactly(tuple(10_000_000L, 10_000_000L), tuple(5_000_000L, 2_090_000L));
    }

    @Test
    void excluding_and_including_a_transaction_settle_the_limit_again() {
        // given
        UUID january = transaction("2025-01-15", "AUTO");
        judgment(january, "AVAILABLE", ENTERTAINMENT, 10_000_000L);
        judgment(transaction("2025-03-02", "AUTO"), "AVAILABLE", ENTERTAINMENT, 5_000_000L);
        settlementService.settleProvisional(userId);

        // when / then
        transactionService.exclude(userId, january);
        assertThat(allowedByTagged()).containsExactly(tuple(5_000_000L, 5_000_000L));

        transactionService.include(userId, january);
        assertThat(allowedByTagged())
            .containsExactly(tuple(10_000_000L, 10_000_000L), tuple(5_000_000L, 2_090_000L));
    }

    @Test
    void deleting_a_batch_settles_the_limit_of_the_other_batches_again() {
        // given: 1월 거래는 다른 batch 에 있다
        UUID mainBatchId = batchId;
        UUID mainRunId = runId;
        batchId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into upload_batch(id, user_id, source_type, card_issuer, period_start, period_end, file_hash)
            values (?, ?, '승인내역', '국민', '2025-01-01', '2025-12-31', ?)
            """, batchId, userId, batchId.toString());
        runId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment_run(id, batch_id, context_id, context_version, status, total_count)
            values (?, ?, (select id from user_context where user_id = ?), 1, 'COMPLETED', 0)
            """, runId, batchId, userId);
        judgment(transaction("2025-01-15", "AUTO"), "AVAILABLE", ENTERTAINMENT, 10_000_000L);
        UUID otherBatchId = batchId;
        batchId = mainBatchId;
        runId = mainRunId;
        judgment(transaction("2025-03-02", "AUTO"), "AVAILABLE", ENTERTAINMENT, 5_000_000L);
        settlementService.settleProvisional(userId);

        // when
        batchService.delete(userId, otherBatchId);

        // then
        assertThat(allowedByTagged()).containsExactly(tuple(5_000_000L, 5_000_000L));
    }

    @Test
    void current_summary_counts_entertainment_by_the_limit_allowed_amount() {
        // given: 1월 1,000만원 + 3월 500만원 접대비, 한도 1,209만원이라 3월은 209만원만 인정된다
        accounted(judgment(transaction("2025-01-15", "AUTO"), "AVAILABLE", ENTERTAINMENT, 10_000_000L), "접대비");
        accounted(judgment(transaction("2025-03-02", "AUTO"), "AVAILABLE", ENTERTAINMENT, 5_000_000L), "접대비");
        accounted(judgment(transaction("2025-02-01", "AUTO"), "AVAILABLE", "{}", 1_000_000L), "소모품비");
        settlementService.settleProvisional(userId);

        // when
        JudgmentSummary byBatch = queryService.summary(userId, batchId, null, null);
        JudgmentSummary byYear = queryService.summary(userId, null, 2025, null);
        JudgmentSummary byRun = queryService.summary(userId, null, null, runId);

        // then: 현재 결과는 한도 초과분 291만원을 빼고, 과거 Run 은 그 Run 의 finalAmount 합 그대로다
        for (JudgmentSummary current : List.of(byBatch, byYear)) {
            assertThat(current.byVerdict().get(Verdict.AVAILABLE).finalAmount()).isEqualTo(13_090_000L);
            assertThat(current.byAccount())
                .extracting(JudgmentSummary.AccountTotal::account, JudgmentSummary.AccountTotal::finalAmount)
                .containsExactly(tuple("접대비", 12_090_000L), tuple("소모품비", 1_000_000L));
        }
        assertThat(byRun.byVerdict().get(Verdict.AVAILABLE).finalAmount()).isEqualTo(16_000_000L);
    }

    private void accounted(UUID judgmentId, String account) {
        jdbcTemplate.update("update judgment set account = ? where id = ?", account, judgmentId);
    }

    /** (tagged_amount, allowed_amount), 큰 금액 순. */
    private List<Tuple> allowedByTagged() {
        return jdbcTemplate.query("""
            select tagged_amount, allowed_amount from limit_bucket_entry
            where user_id = ? order by tagged_amount desc
            """, (row, index) -> tuple(row.getLong("tagged_amount"), row.getLong("allowed_amount")), userId);
    }

    private UUID transaction(String approvedAt, String userInclusion) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, ?::date, '가맹점', '가맹점', '음식점', 0, ?, 'JUDGEABLE', ?, 'CLASSIFIED')
            """, id, batchId, userId, approvedAt, id.toString(), userInclusion);
        return id;
    }

    private UUID judgment(UUID transactionId, String verdict, String attributes, long finalAmount) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into judgment(
                id, transaction_id, revision, rule_card_id, rule_card_version, applied_rule_ids,
                rules_commit_sha, user_context_version, tax_year, verdict, is_inference, run_id,
                attributes, final_amount
            ) values (?, ?, 1, 'R-301', 1, '["R-301"]', 'fixture', 1,
                (select extract(year from approved_at)::int from transaction where id = ?), ?, false, ?, ?::jsonb, ?)
            """, id, transactionId, transactionId, verdict, runId, attributes, finalAmount);
        return id;
    }
}
