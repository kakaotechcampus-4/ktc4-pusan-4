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
import com.ktc4.pusan4.judgment.persistence.JudgmentPersistenceService;
import com.ktc4.pusan4.judgment.persistence.SaveJudgmentCommand;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.UUID;
import java.time.LocalDate;
import java.util.Map;

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
    private JudgmentPersistenceService judgmentPersistenceService;

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
            "merchant_dict"
        );
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
                statute_id, doc_type, hierarchy, effective_from, body, body_hash
            ) values ('소득세법-33-1-2-append-only', '법령', '법률', '2025-01-01', '원문', 'hash-1')
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
                statute_id, doc_type, hierarchy, effective_from, body, body_hash
            ) values ('소득세법-33-1-2', '법령', '법률', '2025-01-01', '원문', 'judgment-hash')
            returning id
            """, Long.class);
        Judgment result = new Judgment(
            Verdict.UNAVAILABLE, Gate.G1, false, null, null,
            List.of("R-004"), List.of(new Citation("소득세법-33-1-2")),
            Map.of("reason", "과태료"), List.of()
        );

        UUID judgmentId = judgmentPersistenceService.save(new SaveJudgmentCommand(
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

        UUID judgmentId = judgmentPersistenceService.save(new SaveJudgmentCommand(
            transactionId, "def456", 3, 2025, LocalDate.of(2025, 3, 14),
            "기타", "미분류 가맹점", "940909",
            List.of(new UserFact("merchant:미분류", "purpose", Map.of("answer", "업무"))),
            result
        ));

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
            "select merchant_raw from unmatched_log where judgment_id = ?", String.class, judgmentId
        )).isEqualTo("미분류 가맹점");
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
}
