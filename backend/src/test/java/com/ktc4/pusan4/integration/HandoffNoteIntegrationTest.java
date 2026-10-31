package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.shared.auth.FixedUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 세무대리인 질문 (api.md 3.14 handoff-notes, docs/agent-secretary.md FR-16).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class HandoffNoteIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void saved_notes_are_listed_in_the_order_they_were_added_with_duplicate_transactions_removed() throws Exception {
        // given
        UUID transactionId = insertTransaction(FixedUser.ID);

        // when
        create("휴대폰 요금의 업무 비중은?", "[\"%s\", \"%s\"]".formatted(transactionId, transactionId))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isNotEmpty())
            .andExpect(jsonPath("$.createdAt").isNotEmpty())
            .andExpect(jsonPath("$.transactionIds.length()").value(1));
        create("자택 월세를 넣어도 되나요?", "[]").andExpect(status().isCreated());

        // then
        mockMvc.perform(get("/api/v1/handoff-notes"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].text").value("휴대폰 요금의 업무 비중은?"))
            .andExpect(jsonPath("$[0].transactionIds[0]").value(transactionId.toString()))
            .andExpect(jsonPath("$[1].text").value("자택 월세를 넣어도 되나요?"));
    }

    @Test
    void another_users_transaction_is_not_found_and_nothing_is_saved() throws Exception {
        // given
        UUID otherUser = UUID.randomUUID();
        jdbcTemplate.update("insert into app_user(id, email) values (?, ?)", otherUser, otherUser + "@example.com");
        UUID theirTransaction = insertTransaction(otherUser);

        // when / then
        create("남의 거래", "[\"%s\"]".formatted(theirTransaction))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("TRANSACTION_NOT_FOUND"));
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from handoff_note where text = '남의 거래'", Integer.class)).isZero();
    }

    @Test
    void invalid_text_is_rejected() throws Exception {
        create("", "[]").andExpect(status().isBadRequest());
        create("가".repeat(301), "[]").andExpect(status().isBadRequest());
    }

    @Test
    void notes_are_deleted_with_the_user() {
        // given
        UUID user = UUID.randomUUID();
        jdbcTemplate.update("insert into app_user(id, email) values (?, ?)", user, user + "@example.com");
        jdbcTemplate.update("insert into handoff_note(id, user_id, text) values (?, ?, '질문')", UUID.randomUUID(), user);

        // when
        jdbcTemplate.update("delete from app_user where id = ?", user);

        // then
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from handoff_note where user_id = ?", Integer.class, user)).isZero();
    }

    private ResultActions create(String text, String transactionIdsJson) throws Exception {
        return mockMvc.perform(post("/api/v1/handoff-notes")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "%s", "transactionIds": %s}
                """.formatted(text, transactionIdsJson)));
    }

    private UUID insertTransaction(UUID userId) {
        UUID batchId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into upload_batch(id, user_id, source_type, card_issuer, period_start, period_end, file_hash)
            values (?, ?, '승인내역', '국민', '2025-01-01', '2025-12-31', ?)
            """, batchId, userId, batchId.toString());
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into transaction(
                id, batch_id, user_id, approved_at, merchant_raw, merchant_norm, merchant_category,
                amount, natural_key, source_status, user_inclusion, classification_status
            ) values (?, ?, ?, '2025-10-08', 'KT', 'KT', '통신', 55000, ?, 'JUDGEABLE', 'AUTO', 'CLASSIFIED')
            """, id, batchId, userId, id.toString());
        return id;
    }
}
