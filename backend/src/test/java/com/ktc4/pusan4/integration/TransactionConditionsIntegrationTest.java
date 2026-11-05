package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.judgment.persistence.QTransactionRecordEntity;
import com.ktc4.pusan4.judgment.persistence.TransactionConditions;
import com.ktc4.pusan4.transaction.api.ClassificationStatus;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.api.UserInclusion;
import com.ktc4.pusan4.transaction.domain.TransactionDetail;
import com.querydsl.core.types.Predicate;
import com.querydsl.jpa.impl.JPAQueryFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 쿼리 조건(TransactionConditions)이 고르는 거래가 Java 규칙(TransactionDetail.effectiveStatus, api.md 2.3)과 같은지
 * 모든 조합으로 본다. 쿼리 조건은 Java 규칙에서 뽑아내므로, 이 테스트는 뽑아내는 방식과
 * "DB 문자열 = enum 이름" 전제를 함께 고정한다.
 */
@SpringBootTest
@Testcontainers
class TransactionConditionsIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final QTransactionRecordEntity TRANSACTION = new QTransactionRecordEntity("transaction");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JPAQueryFactory queryFactory;

    private UUID batchId;
    private final Map<UUID, TransactionDetail> inserted = new HashMap<>();

    /** sourceStatus × userInclusion × classificationStatus 전부. 취소상계 포함은 DB CHECK 가 막아 빠진다. */
    @BeforeEach
    void insertEveryCombination() {
        UUID userId = insertUser();
        batchId = insertBatch(userId);
        for (SourceStatus source : SourceStatus.values()) {
            for (UserInclusion inclusion : UserInclusion.values()) {
                if (source == SourceStatus.CANCELED_OFFSET && inclusion == UserInclusion.INCLUDED) {
                    continue;
                }
                for (ClassificationStatus classification : ClassificationStatus.values()) {
                    insertTransaction(userId, source, inclusion, classification);
                }
            }
        }
        assertThat(inserted).hasSize(16);
    }

    @Test
    void effective_status_condition_matches_java_rule_for_every_status() {
        for (SourceStatus status : SourceStatus.values()) {
            Set<UUID> expected = expected(detail -> detail.effectiveStatus() == status);

            assertThat(select(TransactionConditions.effectiveStatusIs(TRANSACTION, status)))
                .as("effectiveStatus = %s", status)
                .isEqualTo(expected);
        }
    }

    @Test
    void judgment_target_condition_matches_java_rule() {
        Set<UUID> expected = expected(detail -> detail.classificationStatus() == ClassificationStatus.CLASSIFIED
            && detail.effectiveStatus() == SourceStatus.JUDGEABLE);

        assertThat(select(TransactionConditions.judgmentTarget(TRANSACTION))).isEqualTo(expected);
    }

    private Set<UUID> select(Predicate condition) {
        return Set.copyOf(queryFactory.select(TRANSACTION.id)
            .from(TRANSACTION)
            .where(TRANSACTION.batchId.eq(batchId), condition)
            .fetch());
    }

    private Set<UUID> expected(java.util.function.Predicate<TransactionDetail> rule) {
        return inserted.entrySet().stream()
            .filter(entry -> rule.test(entry.getValue()))
            .map(Map.Entry::getKey)
            .collect(Collectors.toSet());
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

    private void insertTransaction(
        UUID userId, SourceStatus source, UserInclusion inclusion, ClassificationStatus classification
    ) {
        UUID id = UUID.randomUUID();
        String category = classification == ClassificationStatus.CLASSIFIED ? "카페" : "미분류";
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, '2025-03-03', '가맹점', '가맹점', ?, 33000, ?, ?, ?, ?)
            """, id, batchId, userId, category, id.toString(), source.name(), inclusion.name(), classification.name());
        inserted.put(id, new TransactionDetail(id, batchId, LocalDate.of(2025, 3, 3), "가맹점", "가맹점", category,
            classification, 33000, 0, source, inclusion));
    }
}
