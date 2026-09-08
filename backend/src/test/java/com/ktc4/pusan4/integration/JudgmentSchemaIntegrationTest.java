package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.merchant.MerchantClassification;
import com.ktc4.pusan4.merchant.MerchantDictionaryRepository;
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
            ) values ('소득세법-33-1-2', '법령', '법률', '2025-01-01', '원문', 'hash-1')
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
