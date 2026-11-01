package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.judgment.domain.RuleSet;
import com.ktc4.pusan4.judgment.persistence.JudgmentRunService;
import org.hibernate.resource.jdbc.spi.StatementInspector;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 판정 run 은 공휴일·조문 버전·사용자 사실을 run 마다 한 번만 읽는다(JudgmentReferences).
 * 거래 수가 두 배인 run 에서도 표마다 한 번이어야 한다. 조문 버전이 두 번 이상이면 RuleSet.statuteIds 에 없는
 * 조문이 인용돼 따로 읽힌 것이다.
 *
 * <p>run 전체의 쿼리 수는 고정하지 않는다. 판정에 기능이 붙으면 정당하게 늘기 때문이다.
 * SQL 은 Hibernate 가 실행하는 것만 센다. 진행 확인은 JdbcTemplate 으로 해서 섞이지 않는다.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.session_factory.statement_inspector="
    + "com.ktc4.pusan4.integration.JudgmentRunReferenceQueriesIntegrationTest$RecordingInspector")
@Testcontainers
class JudgmentRunReferenceQueriesIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    // 규칙 카드마다 인용이 달라 카테고리를 골고루 돌린다.
    private static final List<String> CATEGORIES = List.of(
        "카페", "음식점", "편의점", "온라인쇼핑", "음식배달", "해외SaaS", "국내SW", "통신", "수도광열",
        "여비교통", "차량", "도서", "교육", "광고", "사무용품", "의료", "금융", "지자체_과태료",
        "경찰청_범칙금", "조세", "PG_미상", "기타", "게임", "구독서비스", "여가", "미용", "생활용품"
    );
    private static final List<String> REFERENCE_TABLES = List.of("public_holiday", "statute_version", "user_fact");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JudgmentRunService runService;

    @Autowired
    private RuleSet ruleSet;

    @Test
    void reference_data_is_read_once_per_run_regardless_of_size() {
        insertCitedStatutes();
        Map<String, Long> once = REFERENCE_TABLES.stream().collect(Collectors.toMap(Function.identity(), table -> 1L));

        for (int repeat : List.of(1, 2)) {
            assertThat(referenceReads(repeat))
                .as("거래 %d건 run 의 표별 조회 횟수", CATEGORIES.size() * repeat)
                .isEqualTo(once);
        }
    }

    /** 카테고리마다 거래를 repeat 건 넣은 run 을 돌리고, 참조 표를 읽은 SELECT 수를 센다. */
    private Map<String, Long> referenceReads(int repeat) {
        UUID userId = insertUser();
        UUID batchId = insertBatch(userId);
        UUID contextId = insertContext(userId);
        for (int i = 0; i < CATEGORIES.size() * repeat; i++) {
            insertTransaction(userId, batchId, CATEGORIES.get(i % CATEGORIES.size()), i);
        }
        RecordingInspector.SQL.clear();

        awaitCompleted(runService.create(userId, batchId, contextId).id());

        // 인용 저장(insert … select … from statute_version)은 판정마다 나가는 쓰기라 빼고 SELECT 만 센다.
        List<String> selects = RecordingInspector.SQL.stream()
            .filter(sql -> sql.stripLeading().toLowerCase().startsWith("select"))
            .toList();
        return REFERENCE_TABLES.stream().collect(Collectors.toMap(Function.identity(), table ->
            selects.stream().filter(sql -> sql.contains("from " + table + " ")).count()));
    }

    public static class RecordingInspector implements StatementInspector {

        static final Queue<String> SQL = new ConcurrentLinkedQueue<>();

        @Override
        public String inspect(String sql) {
            SQL.add(sql);
            return sql;
        }
    }

    private void awaitCompleted(UUID runId) {
        Instant deadline = Instant.now().plus(Duration.ofSeconds(30));
        while (Instant.now().isBefore(deadline)) {
            String status = jdbcTemplate.queryForObject(
                "select status from judgment_run where id = ?", String.class, runId);
            if (Set.of("COMPLETED", "PARTIAL_FAILED", "FAILED").contains(status)) {
                assertThat(status).isEqualTo("COMPLETED");
                return;
            }
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(e);
            }
        }
        throw new AssertionError("run " + runId + " did not finish in time");
    }

    private void insertCitedStatutes() {
        for (String statuteId : ruleSet.statuteIds()) {
            jdbcTemplate.update("""
                insert into statute_version(
                    statute_id, doc_type, hierarchy, effective_from, body, body_hash,
                    doc_id, unit_level, title, source_url
                ) values (?, '법령', '법률', '2020-01-01', '원문', 'hash', 'DOC', '호', ?, 'https://law.go.kr/test')
                """, statuteId, statuteId);
        }
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

    private UUID insertContext(UUID ownerId) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into user_context(
                id, user_id, industry_code, prev_year_revenue, business_open_date,
                bookkeeping_duty, has_employee, version
            ) values (?, ?, '940909', 30000000, '2023-01-01', '간편장부', false, 1)
            """, id, ownerId);
        return id;
    }

    private void insertTransaction(UUID userId, UUID batchId, String category, int index) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, ?, ?, ?, ?, 33000, ?, 'JUDGEABLE', 'AUTO', 'CLASSIFIED')
            """, id, batchId, userId, LocalDate.of(2025, 1, 1).plusDays(index * 13L % 365),
            "가맹점" + index, "가맹점" + index, category, id.toString());
    }
}
