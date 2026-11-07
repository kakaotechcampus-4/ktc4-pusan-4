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

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 판정이 이미 있는 DB 에 "transaction current judgment" 마이그레이션을 적용해, 거래마다 현재 판정(api.md §5)을
 * 채우는지 본다. 시작점은 그 직전 버전이고, 두 버전 모두 파일 설명으로 찾는다.
 */
@Testcontainers
class CurrentJudgmentMigrationUpgradeIntegrationTest {

    private static final String TARGET_DESCRIPTION = "transaction current judgment";

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private JdbcTemplate jdbc;

    @Test
    void fills_the_current_judgment_of_existing_transactions() {
        // given: 직전 스키마에 판정 상태가 다른 거래 넷
        List<MigrationInfo> migrations = List.of(flyway(MigrationVersion.LATEST).info().all());
        int target = migrations.indexOf(migrations.stream()
            .filter(info -> TARGET_DESCRIPTION.equals(info.getDescription()))
            .findFirst()
            .orElseThrow());
        flyway(migrations.get(target - 1).getVersion()).migrate();
        jdbc = new JdbcTemplate(new DriverManagerDataSource(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()
        ));
        UUID userId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        UUID contextId = UUID.randomUUID();
        UUID runId = UUID.randomUUID();
        jdbc.update("insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com");
        jdbc.update("""
            insert into upload_batch(id, user_id, source_type, card_issuer, period_start, period_end, file_hash)
            values (?, ?, '승인내역', '국민', '2025-01-01', '2025-12-31', 'upgrade')
            """, batchId, userId);
        jdbc.update("""
            insert into user_context(
                id, user_id, industry_code, prev_year_revenue, business_open_date, bookkeeping_duty, has_employee, version
            ) values (?, ?, '940909', 30000000, '2023-01-01', '간편장부', false, 1)
            """, contextId, userId);
        jdbc.update("""
            insert into judgment_run(id, batch_id, context_id, context_version, status, total_count)
            values (?, ?, ?, 1, 'COMPLETED', 0)
            """, runId, batchId, contextId);

        // 자동 판정만 둘: 최신 revision 이 현재다
        UUID automaticOnly = transaction(userId, batchId);
        automatic(automaticOnly, 1, runId);
        UUID latest = automatic(automaticOnly, 2, runId);
        // 활성 수정 뒤에 자동 판정이 또 생겼다: 수정 revision 이 현재다
        UUID activeOverride = transaction(userId, batchId);
        UUID source = automatic(activeOverride, 1, runId);
        UUID overrideRevision = overridden(activeOverride, 2, override(activeOverride, source, true));
        automatic(activeOverride, 3, runId);
        // 해제한 수정: override 가 아닌 최신 revision 이 현재다
        UUID released = transaction(userId, batchId);
        UUID beforeOverride = automatic(released, 1, runId);
        overridden(released, 2, override(released, beforeOverride, false));
        // 판정이 없다
        UUID notJudged = transaction(userId, batchId);

        // when
        flyway(migrations.get(target).getVersion()).migrate();

        // then
        assertThat(current(automaticOnly)).isEqualTo(latest);
        assertThat(current(activeOverride)).isEqualTo(overrideRevision);
        assertThat(current(released)).isEqualTo(beforeOverride);
        assertThat(current(notJudged)).isNull();
    }

    private UUID transaction(UUID userId, UUID batchId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, '2025-10-08', '스타벅스 서면점', '스타벅스', '카페', 6500, ?, 'JUDGEABLE', 'AUTO', 'CLASSIFIED')
            """, id, batchId, userId, id.toString());
        return id;
    }

    private UUID automatic(UUID transactionId, int revision, UUID runId) {
        return judgment(transactionId, revision, "run_id", runId);
    }

    private UUID overridden(UUID transactionId, int revision, UUID overrideId) {
        return judgment(transactionId, revision, "judgment_override_id", overrideId);
    }

    private UUID judgment(UUID transactionId, int revision, String originColumn, UUID originId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            insert into judgment(
                id, transaction_id, revision, rule_card_id, rule_card_version, applied_rule_ids,
                rules_commit_sha, user_context_version, tax_year, verdict, is_inference, %s
            ) values (?, ?, ?, 'R-300', 1, '["R-300"]', 'fixture', 1, 2025, 'AVAILABLE', false, ?)
            """.formatted(originColumn), id, transactionId, revision, originId);
        return id;
    }

    private UUID override(UUID transactionId, UUID sourceJudgmentId, boolean active) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            insert into judgment_override(id, transaction_id, source_judgment_id, to_verdict, active, released_at)
            values (?, ?, ?, 'UNAVAILABLE', ?, case when ? then null else now() end)
            """, id, transactionId, sourceJudgmentId, active, active);
        return id;
    }

    private UUID current(UUID transactionId) {
        return jdbc.queryForObject(
            "select current_judgment_id from transaction where id = ?", UUID.class, transactionId);
    }

    private static Flyway flyway(MigrationVersion target) {
        return Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .target(target)
            .load();
    }
}
