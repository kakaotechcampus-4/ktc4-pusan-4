package com.ktc4.pusan4.integration;

import org.junit.jupiter.api.BeforeEach;
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

import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 규칙 후보 관리자 API (M1, api.md 3.14). 요청 사용자(demo@example.com)를 관리자 목록에 넣고 부른다.
 * 관리자가 아닐 때의 403 은 AdminPolicyTest 가 본다.
 */
@SpringBootTest(properties = "app.admin.emails=Demo@Example.com")
@AutoConfigureMockMvc
@Testcontainers
class AdminRuleCandidateIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final String DOCS = """
        [{"statute_id": "소득세법시행령-55-1", "quote": "업무와 관련된 비용", "tier": "법령"},
         {"statute_id": "소득세법-27-1", "quote": "총수입금액에 대응하는 비용", "tier": null}]
        """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void clean() {
        jdbcTemplate.update("delete from rule_candidate");
    }

    @Test
    void me_reports_admin_role_for_configured_email() throws Exception {
        mockMvc.perform(get("/api/v1/users/me"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    @Test
    void list_returns_newest_first_with_docs_and_kst_times() throws Exception {
        // given
        long older = insert("사무용품", "대기", "2026-10-20T01:00:00Z");
        long newer = insert("카페", "보류", "2026-10-21T01:00:00Z");

        // when / then
        mockMvc.perform(get("/api/v1/admin/rule-candidates"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].id").value(newer))
            .andExpect(jsonPath("$.items[1].id").value(older))
            .andExpect(jsonPath("$.items[0].status.code").value("ON_HOLD"))
            .andExpect(jsonPath("$.items[0].status.label").value("보류"))
            .andExpect(jsonPath("$.items[0].suggestedDocs[0].statuteId").value("소득세법시행령-55-1"))
            .andExpect(jsonPath("$.items[0].suggestedDocs[1].tier").value(nullValue()))
            .andExpect(jsonPath("$.items[0].createdAt").value("2026-10-21T10:00:00+09:00"))
            .andExpect(jsonPath("$.page.totalElements").value(2));
    }

    @Test
    void list_filters_by_status_and_pages() throws Exception {
        insert("사무용품", "대기", "2026-10-20T01:00:00Z");
        insert("카페", "대기", "2026-10-21T01:00:00Z");
        insert("택시", "승인", "2026-10-22T01:00:00Z");

        mockMvc.perform(get("/api/v1/admin/rule-candidates").param("status", "PENDING").param("size", "1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].merchantCategory").value("카페"))
            .andExpect(jsonPath("$.page.totalElements").value(2))
            .andExpect(jsonPath("$.page.hasNext").value(true));
    }

    @Test
    void approve_records_reviewer_and_second_review_conflicts() throws Exception {
        long id = insert("사무용품", "대기", "2026-10-20T01:00:00Z");

        // when
        mockMvc.perform(post("/api/v1/admin/rule-candidates/{id}/approve", id))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status.code").value("APPROVED"))
            .andExpect(jsonPath("$.reviewedBy").value("demo@example.com"))
            .andExpect(jsonPath("$.reviewedAt", endsWith("+09:00")));

        // then: 이미 처리한 후보는 다시 바꾸지 않는다
        mockMvc.perform(post("/api/v1/admin/rule-candidates/{id}/reject", id))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    @Test
    void on_hold_candidate_can_be_rejected() throws Exception {
        long id = insert("카페", "보류", "2026-10-20T01:00:00Z");

        mockMvc.perform(post("/api/v1/admin/rule-candidates/{id}/reject", id))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status.code").value("REJECTED"));
    }

    @Test
    void unknown_candidate_returns_not_found() throws Exception {
        mockMvc.perform(post("/api/v1/admin/rule-candidates/{id}/approve", 999_999))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("RULE_CANDIDATE_NOT_FOUND"));
    }

    private long insert(String category, String status, String createdAt) {
        return jdbcTemplate.queryForObject("""
            insert into rule_candidate(merchant_category, industry_code, distinct_users, occurrence_count,
                                       suggested_docs, draft_yaml, status, created_at)
            values (?, '940909', 3, 7, ?::jsonb, 'id: R-900', ?, ?::timestamptz)
            returning id
            """, Long.class, category, DOCS, status, createdAt);
    }
}
