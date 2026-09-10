package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.merchant.MerchantClassification;
import com.ktc4.pusan4.merchant.MerchantDictionaryRepository;
import com.ktc4.pusan4.judgment.domain.Citation;
import com.ktc4.pusan4.judgment.domain.Gate;
import com.ktc4.pusan4.judgment.domain.Judgment;
import com.ktc4.pusan4.judgment.domain.QuestionSpec;
import com.ktc4.pusan4.judgment.domain.UnmatchedReason;
import com.ktc4.pusan4.judgment.domain.UserFact;
import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.judgment.limit.FinalizationConditions;
import com.ktc4.pusan4.judgment.limit.LimitAllocation;
import com.ktc4.pusan4.judgment.persistence.JudgmentService;
import com.ktc4.pusan4.judgment.persistence.LimitBucketPersistenceService;
import com.ktc4.pusan4.judgment.persistence.RuleCandidatePersistenceService;
import com.ktc4.pusan4.judgment.persistence.SaveJudgmentCommand;
import com.ktc4.pusan4.judgment.persistence.SaveRuleCandidateCommand;
import com.ktc4.pusan4.judgment.persistence.UserFactPersistenceService;
import jakarta.persistence.NoResultException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Testcontainers
class JudgmentSchemaIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private MerchantDictionaryRepository merchantDictionaryRepository;

    @Autowired
    private JudgmentService judgmentService;

    @Autowired
    private LimitBucketPersistenceService limitBucketPersistenceService;

    @Autowired
    private UserFactPersistenceService userFactPersistenceService;

    @Autowired
    private RuleCandidatePersistenceService ruleCandidatePersistenceService;

    @Test
    void flyway_creates_judgment_core_tables() {
        List<String> tables = jdbcTemplate.queryForList("""
            select table_name
            from information_schema.tables
            where table_schema = 'public'
            order by table_name
            """, String.class);

        assertThat(tables).contains(
            "app_user",
            "user_context",
            "upload_batch",
            "transaction",
            "statute_version",
            "judgment",
            "judgment_citation",
            "user_fact",
            "question_queue",
            "unmatched_log",
            "merchant_dict",
            "rule_candidate"
        );
    }

    @Test
    void rule_candidate_is_stored_as_pending_with_suggested_docs() {
        long candidateId = ruleCandidatePersistenceService.save(new SaveRuleCandidateCommand(
            "구독", "620100", 3, 12,
            List.of("소득세법-33-1-6", "소득세법시행령-67-4"),
            "시행령", "draft"
        ));

        Map<String, Object> stored = jdbcTemplate.queryForMap("""
            select status, merchant_category, distinct_users,
                   suggested_docs ->> 0 as first_doc
            from rule_candidate
            where id = ?
            """, candidateId);
        assertThat(stored)
            .containsEntry("status", "대기")
            .containsEntry("merchant_category", "구독")
            .containsEntry("distinct_users", 3)
            .containsEntry("first_doc", "소득세법-33-1-6");
    }

    @Test
    void rule_candidate_rejects_unknown_status() {
        assertThatThrownBy(() -> jdbcTemplate.update("""
            insert into rule_candidate(merchant_category, industry_code, distinct_users, occurrence_count, status)
            values ('구독', '620100', 3, 12, '알수없음')
            """)).isInstanceOf(DataAccessException.class);
    }

    @Test
    void personal_merchant_classification_precedes_global_entry() {
        UUID userId = UUID.randomUUID();
        jdbcTemplate.update(
            "insert into app_user(id, email) values (?, ?)",
            userId, userId + "@example.com"
        );
        jdbcTemplate.update("""
            insert into merchant_dict(user_id, pattern, merchant_norm, merchant_category, source, confidence)
            values (null, '성진이네', '성진이네', '음식점', '수기', 1.0)
            """);
        jdbcTemplate.update("""
            insert into merchant_dict(user_id, pattern, merchant_norm, merchant_category, source, confidence)
            values (?, '성진이네', '성진이네', '사무용품', 'user', 1.0)
            """, userId);

        MerchantClassification result = merchantDictionaryRepository
            .find(userId, "성진이네")
            .orElseThrow();

        assertThat(result.category()).isEqualTo("사무용품");
    }

    @Test
    void statute_versions_reject_content_updates() {
        Long statuteVersionId = jdbcTemplate.queryForObject("""
            insert into statute_version(
                statute_id, doc_type, hierarchy, effective_from, body, body_hash,
                doc_id, unit_level, title, source_url
            ) values ('소득세법-33-1-2-append-only', '법령', '법률', '2025-01-01', '원문', 'hash-1',
                'DOC-1', '조', '소득세법 제33조', 'https://law.go.kr/test')
            returning id
            """, Long.class);

        assertThatThrownBy(() -> jdbcTemplate.update(
            "update statute_version set body = '변경문' where id = ?", statuteVersionId
        )).isInstanceOf(DataAccessException.class);
    }

    @Test
    void overlapping_batches_cannot_store_same_user_transaction_twice() {
        UUID userId = UUID.randomUUID();
        UUID firstBatchId = UUID.randomUUID();
        UUID secondBatchId = UUID.randomUUID();
        jdbcTemplate.update(
            "insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com"
        );
        insertBatch(firstBatchId, userId, "hash-1");
        insertBatch(secondBatchId, userId, "hash-2");
        insertTransaction(UUID.randomUUID(), firstBatchId, "same-natural-key");

        assertThatThrownBy(() ->
            insertTransaction(UUID.randomUUID(), secondBatchId, "same-natural-key")
        ).isInstanceOf(DataAccessException.class);
    }

    @Test
    void merchant_dictionary_has_no_judgment_columns() {
        List<String> columns = jdbcTemplate.queryForList("""
            select column_name
            from information_schema.columns
            where table_schema = 'public' and table_name = 'merchant_dict'
            """, String.class);

        assertThat(columns).doesNotContain("verdict", "account");
    }

    @Test
    void saves_judgment_with_pinned_statute_version() {
        UUID userId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        UUID transactionId = UUID.randomUUID();
        jdbcTemplate.update(
            "insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com"
        );
        insertBatch(batchId, userId, "judgment-file-hash");
        insertTransaction(transactionId, batchId, "judgment-natural-key");
        Long statuteVersionId = jdbcTemplate.queryForObject("""
            insert into statute_version(
                statute_id, doc_type, hierarchy, effective_from, body, body_hash,
                doc_id, unit_level, title, source_url
            ) values ('소득세법-33-1-2', '법령', '법률', '2025-01-01', '원문', 'judgment-hash',
                'DOC-2', '조', '소득세법 제33조', 'https://law.go.kr/test')
            returning id
            """, Long.class);
        Judgment result = new Judgment(
            Verdict.UNAVAILABLE, Gate.G1, false, null, null,
            List.of("R-004"), List.of(new Citation("소득세법-33-1-2")),
            Map.of("reason", "과태료"), List.of()
        );

        UUID judgmentId = judgmentService.save(new SaveJudgmentCommand(
            transactionId, "abc123", 1, 2025, LocalDate.of(2025, 12, 31),
            List.of(), result
        ));

        Long pinnedVersionId = jdbcTemplate.queryForObject(
            "select statute_version_id from judgment_citation where judgment_id = ?",
            Long.class,
            judgmentId
        );
        assertThat(pinnedVersionId).isEqualTo(statuteVersionId);
    }

    @Test
    void concurrent_judgment_saves_assign_distinct_revisions() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        UUID transactionId = UUID.randomUUID();
        jdbcTemplate.update(
            "insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com"
        );
        insertBatch(batchId, userId, "concurrent-judgment-file-hash");
        insertTransaction(transactionId, batchId, "concurrent-judgment-natural-key");
        Judgment judgment = new Judgment(
            Verdict.AVAILABLE, null, false, null, null,
            List.of(), List.of(), Map.of(), List.of()
        );
        SaveJudgmentCommand command = new SaveJudgmentCommand(
            transactionId, "concurrent-revisions", 1, 2025, LocalDate.of(2025, 12, 31),
            List.of(), judgment
        );
        runConcurrently(8, () -> judgmentService.save(command));

        assertThat(jdbcTemplate.queryForList("""
            select revision
            from judgment
            where transaction_id = ?
            order by revision
            """, Integer.class, transactionId)).containsExactly(1, 2, 3, 4, 5, 6, 7, 8);
    }

    @Test
    void saves_judgment_snapshot_question_and_unmatched_log() {
        UUID userId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        UUID transactionId = UUID.randomUUID();
        jdbcTemplate.update(
            "insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com"
        );
        insertBatch(batchId, userId, "unmatched-file-hash");
        insertTransaction(transactionId, batchId, "unmatched-natural-key");
        Judgment result = new Judgment(
            Verdict.NEEDS_REVIEW, Gate.G2, true, UnmatchedReason.RULE_NOT_FOUND, null,
            List.of("U-001"), List.of(7), List.of(), Map.of("source", "inference"),
            List.of(new QuestionSpec(
                "merchant-purpose", "사용 목적은 무엇인가요?", "purpose", "merchant", List.of("업무", "개인")
            ))
        );

        UUID judgmentId = judgmentService.save(new SaveJudgmentCommand(
            transactionId, "def456", 3, 2025, LocalDate.of(2025, 3, 14),
            "기타", "미분류 가맹점", "940909",
            List.of(new UserFact("merchant:미분류", "purpose", Map.of("answer", "업무"))),
            result
        ));

        assertThat(judgmentId.version()).isEqualTo(7);
        Map<String, Object> snapshot = jdbcTemplate.queryForMap("""
            select rule_card_id, rule_card_version, attributes ->> 'source' as source,
                   input_facts -> 0 ->> 'factType' as fact_type
            from judgment
            where id = ?
            """, judgmentId);
        assertThat(snapshot)
            .containsEntry("rule_card_id", "U-001")
            .containsEntry("rule_card_version", 7)
            .containsEntry("source", "inference")
            .containsEntry("fact_type", "purpose");
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from question_queue where judgment_id = ?", Integer.class, judgmentId
        )).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
            "select id from question_queue where judgment_id = ?", UUID.class, judgmentId
        ).version()).isEqualTo(7);
        assertThat(jdbcTemplate.queryForObject(
            "select merchant_raw from unmatched_log where judgment_id = ?", String.class, judgmentId
        )).isEqualTo("미분류 가맹점");
    }

    @Test
    void judgment_save_rolls_back_all_rows_when_unmatched_context_is_missing() {
        UUID userId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        UUID transactionId = UUID.randomUUID();
        jdbcTemplate.update(
            "insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com"
        );
        insertBatch(batchId, userId, "rollback-file-hash");
        insertTransaction(transactionId, batchId, "rollback-natural-key");
        jdbcTemplate.update("""
            insert into statute_version(
                statute_id, doc_type, hierarchy, effective_from, body, body_hash,
                doc_id, unit_level, title, source_url
            ) values ('rollback-statute', '법령', '법률', '2025-01-01', '원문', 'rollback-hash',
                'DOC-3', '조', '롤백 테스트', 'https://law.go.kr/test')
            """);
        Judgment judgment = new Judgment(
            Verdict.NEEDS_REVIEW, Gate.G2, false, UnmatchedReason.RULE_NOT_FOUND, null,
            List.of(), List.of(), List.of(new Citation("rollback-statute")), Map.of(), List.of()
        );

        assertThatThrownBy(() -> judgmentService.save(new SaveJudgmentCommand(
            transactionId, "rollback", 1, 2025, LocalDate.of(2025, 12, 31),
            List.of(), judgment
        ))).isInstanceOf(NullPointerException.class);

        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from judgment where transaction_id = ?", Integer.class, transactionId
        )).isZero();
    }

    @Test
    void recalculation_replaces_limit_allocations_and_reverts_them_to_provisional() {
        UUID userId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        UUID firstTransactionId = UUID.randomUUID();
        UUID secondTransactionId = UUID.randomUUID();
        UUID firstJudgmentId = UUID.randomUUID();
        UUID secondJudgmentId = UUID.randomUUID();
        insertJudgmentFixture(
            userId, batchId, firstTransactionId, firstJudgmentId, "limit-first"
        );
        insertTransaction(secondTransactionId, batchId, "limit-second-natural-key");
        insertBareJudgment(secondJudgmentId, secondTransactionId);
        List<LimitAllocation> initial = List.of(
            new LimitAllocation(firstJudgmentId, 700_000, 700_000),
            new LimitAllocation(secondJudgmentId, 700_000, 300_000)
        );

        limitBucketPersistenceService.replaceProvisional(
            userId, 2025, "BUSINESS_PROMOTION", initial
        );
        assertThatThrownBy(() -> limitBucketPersistenceService.finalizeEntries(
            userId, 2025, "BUSINESS_PROMOTION", new FinalizationConditions(false, 1, 0)
        )).isInstanceOf(IllegalStateException.class);
        limitBucketPersistenceService.finalizeEntries(
            userId, 2025, "BUSINESS_PROMOTION", new FinalizationConditions(true, 0, 0)
        );
        assertThat(jdbcTemplate.queryForObject("""
            select count(*)
            from limit_bucket_entry
            where user_id = ? and tax_year = 2025
              and bucket_code = 'BUSINESS_PROMOTION' and state = '확정'
            """, Integer.class, userId)).isEqualTo(2);

        limitBucketPersistenceService.replaceProvisional(
            userId,
            2025,
            "BUSINESS_PROMOTION",
            List.of(new LimitAllocation(firstJudgmentId, 250_000, 250_000))
        );

        assertThat(jdbcTemplate.queryForMap("""
            select count(*) as entry_count, sum(allowed_amount)::bigint as allowed_total,
                   min(state) as state, max(state) as max_state
            from limit_bucket_entry
            where user_id = ? and tax_year = 2025 and bucket_code = 'BUSINESS_PROMOTION'
            """, userId))
            .containsEntry("entry_count", 1L)
            .containsEntry("allowed_total", 250_000L)
            .containsEntry("state", "잠정")
            .containsEntry("max_state", "잠정");
    }

    @Test
    void user_facts_are_versioned_and_latest_answer_is_loaded() {
        UUID userId = UUID.randomUUID();
        jdbcTemplate.update(
            "insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com"
        );
        UserFact first = new UserFact(
            "merchant:스타벅스", "용도", Map.of("value", "개인")
        );
        UserFact corrected = new UserFact(
            "merchant:스타벅스", "용도", Map.of("value", "업무미팅")
        );

        UUID firstFactId = userFactPersistenceService.save(userId, first);
        UUID correctedFactId = userFactPersistenceService.save(userId, corrected);

        assertThat(firstFactId.version()).isEqualTo(7);
        assertThat(correctedFactId.version()).isEqualTo(7);
        assertThat(userFactPersistenceService.findLatest(
            userId, "merchant:스타벅스", "용도"
        )).contains(corrected);
        assertThat(jdbcTemplate.queryForList("""
            select version
            from user_fact
            where user_id = ? and scope_key = 'merchant:스타벅스' and fact_type = '용도'
            order by version
            """, Integer.class, userId)).containsExactly(1, 2);
    }

    @Test
    void concurrent_user_fact_saves_assign_distinct_versions() throws Exception {
        UUID userId = UUID.randomUUID();
        jdbcTemplate.update(
            "insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com"
        );
        UserFact fact = new UserFact(
            "merchant:스타벅스", "용도", Map.of("value", "업무")
        );
        runConcurrently(8, () -> userFactPersistenceService.save(userId, fact));

        assertThat(jdbcTemplate.queryForList("""
            select version
            from user_fact
            where user_id = ? and scope_key = 'merchant:스타벅스' and fact_type = '용도'
            order by version
            """, Integer.class, userId)).containsExactly(1, 2, 3, 4, 5, 6, 7, 8);
    }

    @Test
    void loads_only_the_latest_version_of_each_user_fact() {
        UUID userId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();
        jdbcTemplate.update(
            "insert into app_user(id, email) values (?, ?), (?, ?)",
            userId, userId + "@example.com", otherUserId, otherUserId + "@example.com"
        );
        UserFact latestPurpose = new UserFact(
            "merchant:스타벅스", "용도", Map.of("value", "업무미팅")
        );
        UserFact dedicatedLine = new UserFact(
            "merchant:통신사", "전용여부", Map.of("value", "전용")
        );
        userFactPersistenceService.save(userId, new UserFact(
            "merchant:스타벅스", "용도", Map.of("value", "개인")
        ));
        userFactPersistenceService.save(userId, latestPurpose);
        userFactPersistenceService.save(userId, dedicatedLine);
        userFactPersistenceService.save(otherUserId, new UserFact(
            "merchant:스타벅스", "용도", Map.of("value", "개인")
        ));

        List<UserFact> result = userFactPersistenceService.findAllLatest(userId);

        assertThat(result).containsExactlyInAnyOrder(latestPurpose, dedicatedLine);
    }

    @Test
    void answering_question_creates_fact_and_marks_queue_entry_answered() {
        UUID userId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        UUID transactionId = UUID.randomUUID();
        UUID judgmentId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();
        insertJudgmentFixture(userId, batchId, transactionId, judgmentId, "fact-answer");
        jdbcTemplate.update("""
            insert into question_queue(
                id, judgment_id, reason_code, question_text, group_key, fact_type, options
            ) values (?, ?, 'PURPOSE', '용도는 무엇인가요?', 'merchant:스타벅스', '용도', '["업무", "개인"]')
            """, questionId, judgmentId);
        UserFact answer = new UserFact(
            "merchant:스타벅스", "용도", Map.of("value", "업무")
        );

        UUID factId = userFactPersistenceService.answerQuestion(questionId, userId, answer);

        assertThat(jdbcTemplate.queryForMap("""
            select status, answered_fact_id, answered_at is not null as has_answered_at
            from question_queue
            where id = ?
            """, questionId))
            .containsEntry("status", "응답")
            .containsEntry("answered_fact_id", factId)
            .containsEntry("has_answered_at", true);
    }

    @Test
    void answering_another_users_question_is_rejected_without_creating_a_fact() {
        UUID ownerId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        UUID transactionId = UUID.randomUUID();
        UUID judgmentId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();
        insertJudgmentFixture(ownerId, batchId, transactionId, judgmentId, "foreign-question");
        jdbcTemplate.update(
            "insert into app_user(id, email) values (?, ?)",
            otherUserId, otherUserId + "@example.com"
        );
        jdbcTemplate.update("""
            insert into question_queue(
                id, judgment_id, reason_code, question_text, group_key, fact_type, options
            ) values (?, ?, 'PURPOSE', '용도는 무엇인가요?', 'merchant:스타벅스', '용도', '["업무", "개인"]')
            """, questionId, judgmentId);
        UserFact answer = new UserFact(
            "merchant:스타벅스", "용도", Map.of("value", "업무")
        );

        assertThatThrownBy(() ->
            userFactPersistenceService.answerQuestion(questionId, otherUserId, answer)
        ).isInstanceOf(NoResultException.class);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from user_fact where user_id = ?", Integer.class, otherUserId
        )).isZero();
        assertThat(jdbcTemplate.queryForObject(
            "select status from question_queue where id = ?", String.class, questionId
        )).isEqualTo("대기");
    }

    @Test
    void answering_question_with_a_different_fact_scope_is_rejected() {
        UUID userId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        UUID transactionId = UUID.randomUUID();
        UUID judgmentId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();
        insertJudgmentFixture(userId, batchId, transactionId, judgmentId, "wrong-fact-scope");
        jdbcTemplate.update("""
            insert into question_queue(
                id, judgment_id, reason_code, question_text, group_key, fact_type, options
            ) values (?, ?, 'PURPOSE', '용도는 무엇인가요?', 'merchant:스타벅스', '용도', '["업무", "개인"]')
            """, questionId, judgmentId);
        UserFact wrongScope = new UserFact(
            "merchant:다른가맹점", "용도", Map.of("value", "업무")
        );

        assertThatThrownBy(() ->
            userFactPersistenceService.answerQuestion(questionId, userId, wrongScope)
        ).isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("scope");
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from user_fact where user_id = ?", Integer.class, userId
        )).isZero();
        assertThat(jdbcTemplate.queryForObject(
            "select status from question_queue where id = ?", String.class, questionId
        )).isEqualTo("대기");
    }

    @Test
    void answering_question_with_an_unknown_option_is_rejected() {
        UUID userId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        UUID transactionId = UUID.randomUUID();
        UUID judgmentId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();
        insertJudgmentFixture(userId, batchId, transactionId, judgmentId, "unknown-option");
        jdbcTemplate.update("""
            insert into question_queue(
                id, judgment_id, reason_code, question_text, group_key, fact_type, options
            ) values (?, ?, 'PURPOSE', '용도는 무엇인가요?', 'merchant:스타벅스', '용도', '["업무", "개인"]')
            """, questionId, judgmentId);
        UserFact unknownOption = new UserFact(
            "merchant:스타벅스", "용도", Map.of("value", "선물")
        );

        assertThatThrownBy(() ->
            userFactPersistenceService.answerQuestion(questionId, userId, unknownOption)
        ).isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("option");
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from user_fact where user_id = ?", Integer.class, userId
        )).isZero();
        assertThat(jdbcTemplate.queryForObject(
            "select status from question_queue where id = ?", String.class, questionId
        )).isEqualTo("대기");
    }

    @Test
    void answering_question_with_a_different_fact_type_is_rejected() {
        UUID userId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        UUID transactionId = UUID.randomUUID();
        UUID judgmentId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();
        insertJudgmentFixture(userId, batchId, transactionId, judgmentId, "wrong-fact-type");
        jdbcTemplate.update("""
            insert into question_queue(
                id, judgment_id, reason_code, question_text, group_key, fact_type, options
            ) values (?, ?, 'PURPOSE', '용도는 무엇인가요?', 'merchant:스타벅스', '용도', '["업무", "개인"]')
            """, questionId, judgmentId);
        UserFact wrongFactType = new UserFact(
            "merchant:스타벅스", "전용여부", Map.of("value", "업무")
        );

        assertThatThrownBy(() ->
            userFactPersistenceService.answerQuestion(questionId, userId, wrongFactType)
        ).isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Fact type");
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from user_fact where user_id = ?", Integer.class, userId
        )).isZero();
        assertThat(jdbcTemplate.queryForObject(
            "select status from question_queue where id = ?", String.class, questionId
        )).isEqualTo("대기");
    }

    private void runConcurrently(int taskCount, Callable<?> task) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(taskCount);
        CountDownLatch ready = new CountDownLatch(taskCount);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> futures = new ArrayList<>();

        try {
            for (int i = 0; i < taskCount; i++) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    start.await();
                    return task.call();
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            for (Future<?> future : futures) {
                future.get(10, TimeUnit.SECONDS);
            }
        } finally {
            start.countDown();
            executor.shutdownNow();
            executor.awaitTermination(10, TimeUnit.SECONDS);
        }
    }

    private void insertBatch(UUID batchId, UUID userId, String fileHash) {
        jdbcTemplate.update("""
            insert into upload_batch(
                id, user_id, source_type, card_issuer, period_start, period_end, file_hash
            ) values (?, ?, '승인내역', '국민', '2025-01-01', '2025-12-31', ?)
            """, batchId, userId, fileHash);
    }

    private void insertTransaction(UUID transactionId, UUID batchId, String naturalKey) {
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, approved_at, merchant_raw, merchant_norm,
                merchant_category, amount, natural_key, status
            ) values (?, ?, '2025-03-14', '가맹점', '가맹점', '기타', 10000, ?, '판정대상')
            """, transactionId, batchId, naturalKey);
    }

    private void insertJudgmentFixture(
        UUID userId,
        UUID batchId,
        UUID transactionId,
        UUID judgmentId,
        String keySuffix
    ) {
        jdbcTemplate.update(
            "insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com"
        );
        insertBatch(batchId, userId, keySuffix + "-file-hash");
        insertTransaction(transactionId, batchId, keySuffix + "-natural-key");
        insertBareJudgment(judgmentId, transactionId);
    }

    private void insertBareJudgment(UUID judgmentId, UUID transactionId) {
        jdbcTemplate.update("""
            insert into judgment(
                id, transaction_id, revision, rules_commit_sha, user_context_version,
                tax_year, verdict, is_inference
            ) values (?, ?, 1, 'fixture', 1, 2025, 'AVAILABLE', false)
            """, judgmentId, transactionId);
    }
}
