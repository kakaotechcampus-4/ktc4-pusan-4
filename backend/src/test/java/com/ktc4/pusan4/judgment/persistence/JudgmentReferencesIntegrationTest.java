package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.UserFact;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 판정 작업 하나 동안 쓰는 입력(JudgmentReferences). 한 번 읽은 값은 그 작업이 끝날 때까지 다시 읽지 않는다.
 * 조문 버전은 작업을 시작할 때 목록의 조문을 한 번에 읽고, 판정일에 유효한 것을 메모리에서 고른다.
 * effective_from 은 포함, effective_to 는 제외다.
 */
@SpringBootTest
@Testcontainers
class JudgmentReferencesIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JudgmentExecutor executor;

    @Autowired
    private UserFactPersistenceService userFactService;

    @Autowired
    private JudgmentService judgmentService;

    @Test
    void picks_the_statute_version_effective_on_the_date() {
        long old = insertVersion("버전경계", "2020-01-01", "2025-07-01");
        long current = insertVersion("버전경계", "2025-07-01", null);
        StatuteVersions versions = judgmentService.statuteVersions(Set.of("버전경계", "없는조문"));

        assertThat(versions.effectiveVersionId("버전경계", LocalDate.parse("2020-01-01"))).isEqualTo(old);
        assertThat(versions.effectiveVersionId("버전경계", LocalDate.parse("2025-06-30"))).isEqualTo(old);
        assertThat(versions.effectiveVersionId("버전경계", LocalDate.parse("2025-07-01"))).isEqualTo(current);
        assertThatThrownBy(() -> versions.effectiveVersionId("버전경계", LocalDate.parse("2019-12-31")))
            .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> versions.effectiveVersionId("없는조문", LocalDate.parse("2025-07-01")))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void reads_the_statute_versions_once_when_the_work_starts() {
        long first = insertVersion("동기화중", "2020-01-01", null);
        StatuteVersions running = judgmentService.statuteVersions(Set.of("동기화중"));

        // 작업을 시작한 뒤, 이 조문을 처음 인용하기 전에 법령 동기화가 옛 버전을 닫고 새 버전을 넣었다.
        jdbcTemplate.update("update statute_version set effective_to = '2025-08-01' where id = ?", first);
        long revised = insertVersion("동기화중", "2025-08-01", null);

        assertThat(running.effectiveVersionId("동기화중", LocalDate.parse("2025-08-15"))).isEqualTo(first);
        assertThat(judgmentService.statuteVersions(Set.of("동기화중"))
            .effectiveVersionId("동기화중", LocalDate.parse("2025-08-15"))).isEqualTo(revised);
    }

    @Test
    void reads_a_statute_outside_the_list_when_first_cited() {
        StatuteVersions running = judgmentService.statuteVersions(Set.of());
        long version = insertVersion("목록밖", "2020-01-01", null);

        assertThat(running.effectiveVersionId("목록밖", LocalDate.parse("2025-08-15"))).isEqualTo(version);
    }

    @Test
    void keeps_the_user_facts_it_read_until_the_work_ends() {
        UUID userId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        jdbcTemplate.update("insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com");
        jdbcTemplate.update("""
            insert into upload_batch(id, user_id, source_type, card_issuer, period_start, period_end, file_hash)
            values (?, ?, '승인내역', '국민', '2025-01-01', '2025-12-31', ?)
            """, batchId, userId, batchId.toString());
        UserFact personal = new UserFact("merchant:스타벅스", "용도", Map.of("value", "개인"));
        userFactService.save(userId, batchId, personal);
        BatchUserFacts running = executor.references().userFacts();
        assertThat(running.latest(userId, batchId)).containsExactly(personal);

        // run 도중 사용자가 같은 질문에 다시 답했다.
        UserFact business = new UserFact("merchant:스타벅스", "용도", Map.of("value", "업무미팅"));
        userFactService.save(userId, batchId, business);

        assertThat(running.latest(userId, batchId)).containsExactly(personal);
        assertThat(executor.references().userFacts().latest(userId, batchId)).containsExactly(business);
    }

    private long insertVersion(String statuteId, String effectiveFrom, String effectiveTo) {
        return jdbcTemplate.queryForObject("""
            insert into statute_version(
                statute_id, doc_type, hierarchy, effective_from, effective_to, body, body_hash,
                doc_id, unit_level, title, source_url
            ) values (?, '법령', '법률', ?::date, ?::date, '원문', 'hash', 'DOC', '호', ?, 'https://law.go.kr/test')
            returning id
            """, Long.class, statuteId, effectiveFrom, effectiveTo, statuteId);
    }
}
