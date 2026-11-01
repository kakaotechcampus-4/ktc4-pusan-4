package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.transaction.api.CardIssuer;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.api.SourceType;
import com.ktc4.pusan4.transaction.domain.NewTransaction;
import com.ktc4.pusan4.transaction.domain.NewUploadBatch;
import com.ktc4.pusan4.transaction.domain.UploadResult;
import com.ktc4.pusan4.transaction.persistence.UploadService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Testcontainers
class UploadServiceIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private UploadService uploadService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void saves_batch_transactions_and_classification_review_for_unclassified() {
        // given: 키워드로 분류되는 것, PG, 어디에도 안 걸리는 것
        UUID userId = newUser();
        NewUploadBatch input = batch("hash-1",
            tx("k-1", "스타벅스코리아 서면점"),
            tx("k-2", "KG이니시스-스마일카페"),
            tx("k-3", "성진이네 본점"));

        // when
        UploadResult result = uploadService.upload(userId, key(), input);

        // then
        assertThat(result.transactionCount()).isEqualTo(3);
        assertThat(result.skippedDuplicateCount()).isZero();
        assertThat(result.classificationPendingCount()).isEqualTo(1);
        assertThat(result.createdAt().getOffset().getTotalSeconds()).isEqualTo(9 * 3600);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            select natural_key, merchant_norm, merchant_category, classification_status, user_inclusion, user_id
            from transaction where batch_id = ? order by natural_key
            """, result.id());
        assertThat(rows).extracting(r -> r.get("merchant_category"), r -> r.get("classification_status"))
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple("카페", "CLASSIFIED"),
                org.assertj.core.groups.Tuple.tuple("PG_미상", "CLASSIFIED"),
                org.assertj.core.groups.Tuple.tuple("미분류", "NEEDS_REVIEW"));
        assertThat(rows).allSatisfy(r -> {
            assertThat(r.get("user_inclusion")).isEqualTo("AUTO");
            assertThat(r.get("user_id")).isEqualTo(userId);
        });
        assertThat(rows.get(2).get("merchant_norm")).isEqualTo("성진이네");

        assertThat(jdbcTemplate.queryForList("""
            select r.status from classification_review r join transaction t on t.id = r.transaction_id
            where t.batch_id = ? and t.natural_key = 'k-3'
            """, String.class, result.id())).containsExactly("PENDING");
        assertThat(jdbcTemplate.queryForObject("""
            select count(*) from classification_review r join transaction t on t.id = r.transaction_id
            where t.batch_id = ?
            """, Integer.class, result.id())).isEqualTo(1);
    }

    @Test
    void unclassified_canceled_offset_and_excluded_transactions_get_no_classification_review() {
        // given: 셋 다 미분류. 판정에 들어가는 JUDGEABLE 만 분류 검토를 받는다
        UUID userId = newUser();
        UploadResult result = uploadService.upload(userId, key(), batch("hash-skip",
            tx("k-judgeable", "성진이네 본점"),
            tx("k-canceled", "성진이네 본점", SourceStatus.CANCELED_OFFSET),
            tx("k-excluded", "성진이네 본점", SourceStatus.EXCLUDED)));

        // then: 거래는 셋 다 미분류로 저장되고, 분류 검토는 JUDGEABLE 하나만 생긴다
        assertThat(result.transactionCount()).isEqualTo(3);
        assertThat(result.classificationPendingCount()).isEqualTo(1);
        assertThat(jdbcTemplate.queryForList("""
            select classification_status from transaction where batch_id = ?
            """, String.class, result.id())).containsOnly("NEEDS_REVIEW");
        assertThat(jdbcTemplate.queryForList("""
            select t.natural_key from classification_review r join transaction t on t.id = r.transaction_id
            where t.batch_id = ?
            """, String.class, result.id())).containsExactly("k-judgeable");
    }

    @Test
    void optional_fields_are_stored_with_defaults() {
        UUID userId = newUser();
        NewTransaction full = new NewTransaction(LocalDate.parse("2026-01-03"), "스타벅스코리아 서면점", 11_000L, "k-full",
            SourceStatus.CANCELED_OFFSET, 3, "78968731", "1234567890", "서면점", "", "메모", true, true, "부분취소", "kb");

        UploadResult result = uploadService.upload(newUser(), key(), batch("hash-full", full, tx("k-min", "성진이네 본점")));

        Map<String, Object> stored = jdbcTemplate.queryForMap(
            "select * from transaction where batch_id = ? and natural_key = 'k-full'", result.id());
        assertThat(stored).containsEntry("source_status", "CANCELED_OFFSET")
            .containsEntry("installment_months", 3)
            .containsEntry("approval_no", "78968731")
            .containsEntry("biz_no", "1234567890")
            .containsEntry("is_aggregated", true)
            .containsEntry("needs_review", true)
            .containsEntry("review_reason", "부분취소")
            .containsEntry("source_card", "kb");
        Map<String, Object> minimal = jdbcTemplate.queryForMap(
            "select * from transaction where batch_id = ? and natural_key = 'k-min'", result.id());
        assertThat(minimal).containsEntry("installment_months", 0)
            .containsEntry("is_aggregated", false)
            .containsEntry("needs_review", false);
    }

    @Test
    void skips_natural_keys_already_uploaded_and_repeated_in_same_request() {
        // given: 첫 파일에 k-1, k-2
        UUID userId = newUser();
        uploadService.upload(userId, key(), batch("hash-a", tx("k-1", "스타벅스코리아 서면점"), tx("k-2", "성진이네 본점")));

        // when: 다른 파일에 k-2(기존 중복), k-3, k-3(같은 요청 안의 반복)
        UploadResult second = uploadService.upload(userId, key(),
            batch("hash-b", tx("k-2", "성진이네 본점"), tx("k-3", "스타벅스코리아 서면점"), tx("k-3", "스타벅스코리아 서면점")));

        // then: 저장 1, 건너뜀 2. 건너뛴 거래는 분류 검토도 만들지 않는다
        assertThat(second.transactionCount()).isEqualTo(1);
        assertThat(second.skippedDuplicateCount()).isEqualTo(2);
        assertThat(second.classificationPendingCount()).isZero();
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from transaction where user_id = ?", Integer.class, userId)).isEqualTo(3);
    }

    @Test
    void same_natural_key_from_another_user_is_not_a_duplicate() {
        uploadService.upload(newUser(), key(), batch("hash-x", tx("shared-key", "스타벅스코리아 서면점")));

        UploadResult other = uploadService.upload(newUser(), key(), batch("hash-x", tx("shared-key", "스타벅스코리아 서면점")));

        assertThat(other.transactionCount()).isEqualTo(1);
        assertThat(other.skippedDuplicateCount()).isZero();
    }

    @Test
    void all_duplicates_still_creates_an_empty_batch() {
        // 계약상 naturalKey 중복은 batch 실패 사유가 아니다. 거래 0건 batch 가 남는다
        UUID userId = newUser();
        uploadService.upload(userId, key(), batch("hash-1", tx("k-1", "스타벅스코리아 서면점")));

        UploadResult again = uploadService.upload(userId, key(), batch("hash-2", tx("k-1", "스타벅스코리아 서면점")));

        assertThat(again.transactionCount()).isZero();
        assertThat(again.skippedDuplicateCount()).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from upload_batch where user_id = ?", Integer.class, userId)).isEqualTo(2);
    }

    @Test
    void same_file_hash_is_duplicate_file_and_saves_nothing() {
        UUID userId = newUser();
        uploadService.upload(userId, key(), batch("hash-dup", tx("k-1", "스타벅스코리아 서면점")));

        assertThatThrownBy(() -> uploadService.upload(userId, key(), batch("hash-dup", tx("k-9", "스타벅스코리아 서면점"))))
            .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("DUPLICATE_FILE"));
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from transaction where user_id = ? and natural_key = 'k-9'", Integer.class, userId)).isZero();
    }

    @Test
    void unknown_user_is_unauthorized() {
        assertThatThrownBy(() -> uploadService.upload(UUID.randomUUID(), key(), batch("h", tx("k", "스타벅스코리아 서면점"))))
            .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("UNAUTHORIZED"));
    }

    @Test
    void concurrent_uploads_of_same_file_create_one_batch_and_one_conflict() throws Exception {
        // 사용자 잠금이 없으면 둘 다 "없음"으로 보고 INSERT 해 UNIQUE 위반이 500 으로 나간다
        UUID userId = newUser();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<Object>> futures = List.of(
                pool.submit(() -> uploadAfter(start, userId)),
                pool.submit(() -> uploadAfter(start, userId)));
            start.countDown();
            List<Object> outcomes = List.of(futures.get(0).get(30, TimeUnit.SECONDS), futures.get(1).get(30, TimeUnit.SECONDS));

            assertThat(outcomes).filteredOn(UploadResult.class::isInstance).hasSize(1);
            assertThat(outcomes).filteredOn(o -> o instanceof ApiException e && e.getCode().equals("DUPLICATE_FILE"))
                .hasSize(1);
        } finally {
            pool.shutdownNow();
        }
    }

    private Object uploadAfter(CountDownLatch start, UUID userId) throws InterruptedException {
        start.await();
        try {
            return uploadService.upload(userId, key(), batch("hash-race", tx("race-1", "스타벅스코리아 서면점")));
        } catch (ApiException e) {
            return e;
        }
    }

    private static String key() {
        return UUID.randomUUID().toString();
    }

    private UUID newUser() {
        UUID userId = UUID.randomUUID();
        jdbcTemplate.update("insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com");
        return userId;
    }

    private static NewUploadBatch batch(String fileHash, NewTransaction... transactions) {
        return new NewUploadBatch(SourceType.승인내역, CardIssuer.국민,
            LocalDate.parse("2026-01-01"), LocalDate.parse("2026-01-31"), fileHash, List.of(transactions));
    }

    private static NewTransaction tx(String naturalKey, String merchantRaw) {
        return tx(naturalKey, merchantRaw, SourceStatus.JUDGEABLE);
    }

    private static NewTransaction tx(String naturalKey, String merchantRaw, SourceStatus status) {
        return new NewTransaction(LocalDate.parse("2026-01-03"), merchantRaw, 11_000L, naturalKey,
            status, 0, null, null, null, null, null, false, false, null, null);
    }
}
