package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.judgment.persistence.TransactionRecordEntity;
import com.ktc4.pusan4.judgment.persistence.UploadBatchEntity;
import com.ktc4.pusan4.transaction.api.CardIssuer;
import com.ktc4.pusan4.transaction.api.ClassificationStatus;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.api.SourceType;
import com.ktc4.pusan4.transaction.domain.NewTransaction;
import com.ktc4.pusan4.transaction.domain.NewUploadBatch;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * insert 를 저장한 순서대로 보내는지 본다. 엔티티에 연관관계 매핑이 없어 Hibernate 는 FK 순서를 모른다.
 * hibernate.order_inserts 를 켜면 테이블별로 묶으면서 자식 insert 를 새 부모보다 먼저 보내 이 테스트가 깨진다.
 */
@SpringBootTest
@Testcontainers
class InsertOrderIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void saves_a_child_queued_before_a_new_parent_in_one_transaction() {
        // given: 이미 저장된 거래 하나
        UUID userId = newUser();
        UUID batchId = newBatch(userId);
        TransactionRecordEntity existing = transaction(batchId, userId);
        transactionTemplate.executeWithoutResult(status -> entityManager.persist(existing));

        // when: 기존 거래의 review → 새 거래 → 새 거래의 review 순서로 한 트랜잭션에서 저장
        transactionTemplate.executeWithoutResult(status -> {
            entityManager.persist(review(existing.id()));
            TransactionRecordEntity fresh = transaction(batchId, userId);
            entityManager.persist(fresh);
            entityManager.persist(review(fresh.id()));
        });

        // then
        assertThat(jdbcTemplate.queryForObject("""
            select count(*) from classification_review r join transaction t on t.id = r.transaction_id
            where t.batch_id = ?
            """, Integer.class, batchId)).isEqualTo(2);
    }

    private UUID newUser() {
        UUID userId = UUID.randomUUID();
        jdbcTemplate.update("insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com");
        return userId;
    }

    private UUID newBatch(UUID userId) {
        UploadBatchEntity batch = new UploadBatchEntity(UUID.randomUUID(), userId,
            new NewUploadBatch(SourceType.승인내역, CardIssuer.국민, LocalDate.parse("2026-01-01"),
                LocalDate.parse("2026-01-31"), UUID.randomUUID().toString(), List.of()),
            0, OffsetDateTime.now());
        transactionTemplate.executeWithoutResult(status -> entityManager.persist(batch));
        return batch.id();
    }

    private static TransactionRecordEntity transaction(UUID batchId, UUID userId) {
        NewTransaction input = new NewTransaction(LocalDate.parse("2026-01-03"), "성진이네 본점", 11_000L,
            UUID.randomUUID().toString(), SourceStatus.JUDGEABLE, 0, null, null, null, null, null, false, false, null, null);
        return new TransactionRecordEntity(UUID.randomUUID(), batchId, userId, input, "성진이네", "미분류",
            ClassificationStatus.NEEDS_REVIEW, OffsetDateTime.now());
    }

    private static ClassificationReviewEntity review(UUID transactionId) {
        return ClassificationReviewEntity.pending(UUID.randomUUID(), transactionId, OffsetDateTime.now());
    }
}
