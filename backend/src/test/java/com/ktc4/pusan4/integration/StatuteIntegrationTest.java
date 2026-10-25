package com.ktc4.pusan4.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class StatuteIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void returns_stored_statute_version() throws Exception {
        // given: 법령 동기화(law_sync.py)가 넣은 원문 한 건
        Long id = jdbcTemplate.queryForObject("""
            insert into statute_version(
                statute_id, doc_type, hierarchy, effective_from, effective_to, body, body_hash,
                doc_id, unit_level, title, source_url
            ) values ('소득세법시행령-67-4', '법령', '시행령', '2025-01-01', '2026-01-01', '시행령 원문', 'hash-67-4',
                'DOC-67', '항', '소득세법 시행령 제67조 제4항', 'https://www.law.go.kr/test')
            returning id
            """, Long.class);

        // when / then
        mockMvc.perform(get("/api/v1/statutes/{id}", id))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.statuteVersionId").value(id))
            .andExpect(jsonPath("$.statuteId").value("소득세법시행령-67-4"))
            .andExpect(jsonPath("$.title").value("소득세법 시행령 제67조 제4항"))
            .andExpect(jsonPath("$.hierarchy").value("시행령"))
            .andExpect(jsonPath("$.effectiveFrom").value("2025-01-01"))
            .andExpect(jsonPath("$.effectiveTo").value("2026-01-01"))
            .andExpect(jsonPath("$.sourceUrl").value("https://www.law.go.kr/test"))
            .andExpect(jsonPath("$.body").value("시행령 원문"));
    }

    @Test
    void unknown_statute_version_returns_statute_not_found() throws Exception {
        // when / then: api.md 3.13
        mockMvc.perform(get("/api/v1/statutes/{id}", Long.MAX_VALUE))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("STATUTE_NOT_FOUND"));
    }
}
