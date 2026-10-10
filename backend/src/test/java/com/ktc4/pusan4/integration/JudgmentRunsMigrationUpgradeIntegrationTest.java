package com.ktc4.pusan4.integration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Arrays;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 행이 이미 있는 DB 에 "judgment runs and delete policy" 마이그레이션을 적용한다.
 * 다른 테스트는 빈 DB 에 끝까지 적용하므로 기존 행 변환과 제약 재생성을 보지 못한다.
 *
 * <p>시작점은 V5 스키마로 고정한다(아래 INSERT 가 V5 컬럼을 쓴다). 끝점은 파일 설명으로 찾는다.
 * merge 직전에 마이그레이션 번호를 바꿔도 이 테스트는 고치지 않아도 된다.
 */
@Testcontainers
class JudgmentRunsMigrationUpgradeIntegrationTest {

    private static final String TARGET_DESCRIPTION = "judgment runs and delete policy";

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Test
    void keeps_existing_rows_converts_question_status_and_cascades_from_batch() {
        migrateTo(MigrationVersion.fromVersion("5"));
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()
        ));
        UUID userId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        UUID transactionId = UUID.randomUUID();
        UUID judgmentId = UUID.randomUUID();
        UUID factId = UUID.randomUUID();
        UUID pending = UUID.randomUUID();
        UUID answered = UUID.randomUUID();
        UUID canceled = UUID.randomUUID();
        jdbc.update("insert into app_user(id, email) values (?, 'upgrade@example.com')", userId);
        jdbc.update("""
            insert into upload_batch(id, user_id, source_type, card_issuer, period_start, period_end, file_hash)
            values (?, ?, '승인내역', '국민', '2025-01-01', '2025-12-31', 'upgrade')
            """, batchId, userId);
        jdbc.update("""
            insert into transaction(
                id, batch_id, approved_at, merchant_raw, merchant_norm, merchant_category, amount, natural_key, status
            ) values (?, ?, '2025-03-14', '가맹점', '가맹점', '카페', 6500, 'upgrade', '판정대상')
            """, transactionId, batchId);
        jdbc.update("""
            insert into judgment(
                id, transaction_id, revision, rules_commit_sha, user_context_version, tax_year, verdict, is_inference
            ) values (?, ?, 1, 'old', 1, 2025, 'NEEDS_REVIEW', false)
            """, judgmentId, transactionId);
        jdbc.update("""
            insert into user_fact(id, user_id, scope_key, fact_type, value, version)
            values (?, ?, 'merchant:가맹점', '용도', '{"value": "업무"}', 1)
            """, factId, userId);
        insertQuestion(jdbc, pending, judgmentId, "대기", null);
        insertQuestion(jdbc, answered, judgmentId, "응답", factId);
        insertQuestion(jdbc, canceled, judgmentId, "취소", null);

        migrateTo(targetVersion());

        assertThat(jdbc.queryForObject("select status from question_queue where id = ?", String.class, pending))
            .isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("select status from question_queue where id = ?", String.class, answered))
            .isEqualTo("ANSWERED");
        assertThat(jdbc.queryForObject("select status from question_queue where id = ?", String.class, canceled))
            .isEqualTo("CANCELED");
        Map<String, Object> judgment = jdbc.queryForMap(
            "select run_id, rules_commit_sha from judgment where id = ?", judgmentId
        );
        assertThat(judgment).containsEntry("rules_commit_sha", "old").containsEntry("run_id", null);
        assertThat(jdbc.queryForList("""
            select column_name from information_schema.columns
            where table_name = 'judgment' and column_name = 'state'
            """, String.class)).isEmpty();
        assertThat(jdbc.queryForObject(
            "select batch_id from user_fact where id = ?", UUID.class, factId
        )).isNull();

        // V7 이전에는 판정이 있는 batch 를 지울 수 없었다(judgment.transaction_id 에 CASCADE 가 없었다).
        jdbc.update("delete from upload_batch where id = ?", batchId);

        assertThat(jdbc.queryForObject("select count(*) from judgment where id = ?", Integer.class, judgmentId))
            .isZero();
        assertThat(jdbc.queryForObject(
            "select count(*) from question_queue where judgment_id = ?", Integer.class, judgmentId
        )).isZero();
    }

    private static void insertQuestion(JdbcTemplate jdbc, UUID id, UUID judgmentId, String status, UUID factId) {
        jdbc.update("""
            insert into question_queue(
                id, judgment_id, reason_code, question_text, group_key, fact_type, status, answered_fact_id, answered_at
            ) values (?, ?, 'PURPOSE', '용도는?', 'merchant:가맹점', '용도', ?, ?, case when ? then now() end)
            """, id, judgmentId, status, factId, factId != null);
    }

    private static Flyway flyway(MigrationVersion target) {
        return Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .target(target)
            .load();
    }

    private static void migrateTo(MigrationVersion target) {
        flyway(target).migrate();
    }

    private static MigrationVersion targetVersion() {
        return Arrays.stream(flyway(MigrationVersion.LATEST).info().all())
            .filter(info -> TARGET_DESCRIPTION.equals(info.getDescription()))
            .map(MigrationInfo::getVersion)
            .findFirst()
            .orElseThrow();
    }
}
