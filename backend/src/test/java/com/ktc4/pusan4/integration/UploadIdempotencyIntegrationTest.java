package com.ktc4.pusan4.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ktc4.pusan4.shared.auth.FixedUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * POST /api/v1/upload-batches 의 Idempotency-Key 계약 (api.md 1.6, 3.3).
 * 현재 사용자는 임시 사용자 하나라 테스트마다 fileHash·키·naturalKey 를 새로 만든다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class UploadIdempotencyIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final UUID USER = FixedUser.ID;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void first_request_creates_batch_and_returns_201() throws Exception {
        String body = body(unique());

        mockMvc.perform(upload(unique(), body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isNotEmpty())
            .andExpect(jsonPath("$.transactionCount").value(2))
            .andExpect(jsonPath("$.skippedDuplicateCount").value(0))
            .andExpect(jsonPath("$.classificationPendingCount").value(1))
            .andExpect(jsonPath("$.createdAt").value(org.hamcrest.Matchers.endsWith("+09:00")));
    }

    @Test
    void same_key_and_same_payload_replays_first_response_without_new_batch() throws Exception {
        String key = unique();
        String body = body(unique());
        String first = created(key, body);
        int batches = batchCount();

        String second = mockMvc.perform(upload(key, body)).andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();

        assertThat(objectMapper.readTree(second)).isEqualTo(objectMapper.readTree(first));
        assertThat(batchCount()).isEqualTo(batches);
    }

    @Test
    void field_order_and_whitespace_do_not_change_payload_identity() throws Exception {
        String key = unique();
        String hash = unique();
        String first = created(key, body(hash));

        // 같은 값을 키 순서를 바꾸고 줄바꿈을 넣어 다시 보낸다
        JsonNode reordered = objectMapper.readTree(body(hash));
        String shuffled = "{\n \"transactions\": " + reordered.get("transactions") + ",\n \"fileHash\": \"" + hash
            + "\", \"periodEnd\": \"2026-01-31\", \"periodStart\": \"2026-01-01\", \"cardIssuer\": \"국민\", \"sourceType\": \"승인내역\"}";

        String second = mockMvc.perform(upload(key, shuffled)).andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        assertThat(objectMapper.readTree(second).get("id")).isEqualTo(objectMapper.readTree(first).get("id"));
    }

    @Test
    void same_key_with_different_payload_is_409_reused() throws Exception {
        String key = unique();
        created(key, body(unique()));

        mockMvc.perform(upload(key, body(unique())))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
    }

    @Test
    void replay_after_batch_deleted_is_410() throws Exception {
        String key = unique();
        String body = body(unique());
        UUID batchId = UUID.fromString(objectMapper.readTree(created(key, body)).get("id").asText());

        // B6 전이라 SQL 로 지운다. FK 가 거래·분류 검토를 연쇄 삭제하고 키의 batch_id 를 NULL 로 만든다
        jdbcTemplate.update("delete from upload_batch where id = ?", batchId);

        mockMvc.perform(upload(key, body))
            .andExpect(status().isGone())
            .andExpect(jsonPath("$.code").value("IDEMPOTENCY_RESULT_DELETED"));
        // 키는 지워지지 않고 남는다
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from idempotency_key where user_id = ? and idempotency_key = ? and batch_id is null",
            Integer.class, USER, key)).isEqualTo(1);
    }

    @Test
    void expired_key_is_a_new_request_and_file_hash_rule_still_applies() throws Exception {
        String key = unique();
        String body = body(unique());
        created(key, body);
        expire(key);

        // 같은 파일이 남아 있으므로 새 요청으로 처리되면 DUPLICATE_FILE 이다
        mockMvc.perform(upload(key, body))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("DUPLICATE_FILE"));
    }

    @Test
    void expired_key_can_be_reused_for_a_different_upload() throws Exception {
        String key = unique();
        String firstId = objectMapper.readTree(created(key, body(unique()))).get("id").asText();
        expire(key);

        String secondId = objectMapper.readTree(created(key, body(unique()))).get("id").asText();

        assertThat(secondId).isNotEqualTo(firstId);
        assertThat(jdbcTemplate.queryForObject(
            "select batch_id::text from idempotency_key where user_id = ? and idempotency_key = ?",
            String.class, USER, key)).isEqualTo(secondId);
    }

    @Test
    void missing_or_blank_key_is_400() throws Exception {
        String body = body(unique());
        mockMvc.perform(post("/api/v1/upload-batches").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REQUIRED"));
        mockMvc.perform(upload(" ", body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REQUIRED"));
    }

    @Test
    void invalid_request_is_rejected_before_key_is_stored() throws Exception {
        String key = unique();
        String invalid = body(unique()).replace("\"승인내역\"", "\"청구내역\"");

        mockMvc.perform(upload(key, invalid))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("INVALID_SOURCE_TYPE"));
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from idempotency_key where idempotency_key = ?", Integer.class, key)).isZero();
    }

    @Test
    void concurrent_requests_with_same_key_create_one_batch_and_same_response() throws Exception {
        String key = unique();
        String body = body(unique());
        int batches = batchCount();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<MvcResult>> futures = List.of(
                pool.submit(() -> { start.await(); return mockMvc.perform(upload(key, body)).andReturn(); }),
                pool.submit(() -> { start.await(); return mockMvc.perform(upload(key, body)).andReturn(); }));
            start.countDown();
            MvcResult a = futures.get(0).get(30, TimeUnit.SECONDS);
            MvcResult b = futures.get(1).get(30, TimeUnit.SECONDS);

            assertThat(a.getResponse().getStatus()).isEqualTo(201);
            assertThat(b.getResponse().getStatus()).isEqualTo(201);
            assertThat(objectMapper.readTree(a.getResponse().getContentAsString()))
                .isEqualTo(objectMapper.readTree(b.getResponse().getContentAsString()));
            assertThat(batchCount()).isEqualTo(batches + 1);
        } finally {
            pool.shutdownNow();
        }
    }

    private String created(String key, String body) throws Exception {
        return mockMvc.perform(upload(key, body)).andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
    }

    private org.springframework.test.web.servlet.RequestBuilder upload(String key, String body) {
        return post("/api/v1/upload-batches")
            .header("Idempotency-Key", key)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body);
    }

    /** 24시간이 지난 것처럼 만든다. CHECK(expires_at > response_created_at) 를 지키려고 둘 다 옮긴다. */
    private void expire(String key) {
        jdbcTemplate.update("""
            update idempotency_key
            set response_created_at = response_created_at - interval '25 hours',
                expires_at = now() - interval '1 second'
            where user_id = ? and idempotency_key = ?
            """, USER, key);
    }

    private int batchCount() {
        return jdbcTemplate.queryForObject("select count(*) from upload_batch where user_id = ?", Integer.class, USER);
    }

    private static String unique() {
        return UUID.randomUUID().toString();
    }

    /** 키워드로 분류되는 거래 1건 + 미분류 1건. naturalKey 는 fileHash 를 붙여 테스트끼리 겹치지 않게 한다. */
    private static String body(String fileHash) {
        return """
            {
              "sourceType": "승인내역",
              "cardIssuer": "국민",
              "periodStart": "2026-01-01",
              "periodEnd": "2026-01-31",
              "fileHash": "%1$s",
              "transactions": [
                {"approvedAt": "2026-01-03", "merchantRaw": "스타벅스코리아 서면점", "amount": 11000,
                 "naturalKey": "%1$s-1", "status": "JUDGEABLE"},
                {"approvedAt": "2026-01-04", "merchantRaw": "성진이네 본점", "amount": 23000,
                 "naturalKey": "%1$s-2", "status": "JUDGEABLE", "installmentMonths": 0}
              ]
            }
            """.formatted(fileHash);
    }
}
