package com.ktc4.pusan4.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.jayway.jsonpath.JsonPath;
import com.ktc4.pusan4.merchant.classify.ModelClassifier;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.willAnswer;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 분류 모델 연동 (docs/backend_api_plan.md B10). AI 서버 자리에 가짜 HTTP 서버를 띄운다.
 * 「성진이네 본점」「ZQXW TRADING」은 사전·키워드에 없어 규칙으로는 미분류다. 사용자는 임시 사용자 하나라 batch 로 거른다.
 */
@SpringBootTest(properties = "app.classify.enabled=true")
@AutoConfigureMockMvc
@Testcontainers
class MerchantModelClassifyIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final String UNSURE = """
        {"category": "해외SaaS", "confidence": 0.62, "known": 0.40,
         "suggestions": ["해외SaaS", "기타", "온라인쇼핑", "국내SW"], "refused": false}""";
    private static final String SURE = """
        {"category": "음식점", "confidence": 1.00, "known": 0.99, "suggestions": ["음식점", "카페"], "refused": false}""";

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final AtomicReference<String> AI_RESULT = new AtomicReference<>();
    private static final AtomicInteger AI_DELAY_MS = new AtomicInteger();
    private static final AtomicReference<String> AI_BODY = new AtomicReference<>();
    private static final HttpServer AI = fakeAiServer();

    @DynamicPropertySource
    static void classifyServer(DynamicPropertyRegistry registry) {
        registry.add("app.classify.base-url", () -> "http://localhost:" + AI.getAddress().getPort());
        registry.add("app.classify.read-timeout", () -> "1s");
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoSpyBean
    private ModelClassifier modelClassifier;

    @BeforeEach
    void setUp() {
        AI_RESULT.set(UNSURE);
        AI_DELAY_MS.set(0);
        AI_BODY.set(null);
        // 모델을 기다리는 동안 사용자 잠금·DB 커넥션을 잡지 않도록 트랜잭션 밖에서만 부른다
        willAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return invocation.callRealMethod();
        }).given(modelClassifier).classify(any());
    }

    @Test
    void model_answer_goes_to_review_with_three_suggestions_and_canceled_only_merchant_is_not_sent() throws Exception {
        String batchId = upload(unique(), body(tx("성진이네 본점", "JUDGEABLE"), tx("ZQXW TRADING", "CANCELED_OFFSET")));

        mockMvc.perform(get("/api/v1/classification-reviews").param("batchId", batchId).param("grouped", "true"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].suggestedCategories").value(contains("해외SaaS", "온라인쇼핑", "국내SW")));
        assertThat(AI_BODY.get()).contains("성진이네").doesNotContain("ZQXW");
        assertThat(decidedCategories(batchId)).containsExactly("해외SaaS");
    }

    @Test
    void sure_answer_is_not_confirmed_and_not_written_to_the_dictionary() throws Exception {
        AI_RESULT.set(SURE);

        String batchId = upload(unique(), body(tx("성진이네 본점", "JUDGEABLE")));

        assertThat(jdbcTemplate.queryForMap(
            "select merchant_category, classification_status from transaction where batch_id = ?::uuid", batchId))
            .containsEntry("merchant_category", "미분류")
            .containsEntry("classification_status", "NEEDS_REVIEW");
        mockMvc.perform(get("/api/v1/classification-reviews").param("batchId", batchId).param("grouped", "true"))
            .andExpect(jsonPath("$.items[0].suggestedCategories").value(contains("음식점", "카페")));
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from merchant_dict where pattern = '성진이네'", Integer.class)).isZero();
    }

    @Test
    void slow_ai_server_still_uploads_with_empty_suggestions() throws Exception {
        AI_DELAY_MS.set(1_500);

        String batchId = upload(unique(), body(tx("성진이네 본점", "JUDGEABLE")));

        mockMvc.perform(get("/api/v1/classification-reviews").param("batchId", batchId).param("grouped", "true"))
            .andExpect(jsonPath("$.items[0].suggestedCategories").isEmpty());
        assertThat(decidedCategories(batchId)).isEmpty();
    }

    @Test
    void replay_and_duplicate_file_do_not_ask_the_model() throws Exception {
        String key = unique();
        String body = body(tx("성진이네 본점", "JUDGEABLE"));
        upload(key, body);

        mockMvc.perform(uploadRequest(key, body)).andExpect(status().isCreated());
        mockMvc.perform(uploadRequest(unique(), body)).andExpect(status().isConflict());

        verify(modelClassifier, times(1)).classify(any());
    }

    @Test
    void deleting_the_batch_deletes_its_model_decisions() throws Exception {
        String batchId = upload(unique(), body(tx("성진이네 본점", "JUDGEABLE")));
        UUID transactionId = transactionOf(batchId);

        mockMvc.perform(delete("/api/v1/upload-batches/" + batchId)).andExpect(status().isNoContent());

        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from merchant_model_decision where transaction_id = ?", Integer.class, transactionId))
            .isZero();
    }

    @Test
    void review_created_by_including_an_excluded_transaction_shows_the_suggestions() throws Exception {
        String batchId = upload(unique(), body(tx("성진이네 본점", "EXCLUDED")));

        mockMvc.perform(post("/api/v1/transactions/" + transactionOf(batchId) + "/include")).andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/classification-reviews").param("batchId", batchId))
            .andExpect(jsonPath("$.items[0].suggestedCategories").value(contains("해외SaaS", "온라인쇼핑", "국내SW")));
    }

    private String upload(String key, String body) throws Exception {
        String response = mockMvc.perform(uploadRequest(key, body)).andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.id");
    }

    private static RequestBuilder uploadRequest(String key, String body) {
        return post("/api/v1/upload-batches")
            .header("Idempotency-Key", key)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body);
    }

    private List<String> decidedCategories(String batchId) {
        return jdbcTemplate.queryForList("""
            select d.category from merchant_model_decision d join transaction t on t.id = d.transaction_id
            where t.batch_id = ?::uuid
            """, String.class, batchId);
    }

    private UUID transactionOf(String batchId) {
        return jdbcTemplate.queryForObject("select id from transaction where batch_id = ?::uuid", UUID.class, batchId);
    }

    private static String unique() {
        return UUID.randomUUID().toString();
    }

    private static String body(String... transactions) {
        return """
            {"sourceType": "승인내역", "cardIssuer": "국민", "periodStart": "2026-01-01", "periodEnd": "2026-01-31",
             "fileHash": "%s", "transactions": [%s]}
            """.formatted(unique(), String.join(",", transactions));
    }

    private static String tx(String merchantRaw, String status) {
        return """
            {"approvedAt": "2026-01-03", "merchantRaw": "%s", "amount": 11000, "naturalKey": "%s", "status": "%s"}
            """.formatted(merchantRaw, unique(), status);
    }

    /** 요청 items 마다 AI_RESULT 를 merchantNorm 만 바꿔 같은 순서로 돌려준다. */
    private static HttpServer fakeAiServer() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
            server.createContext("/classify/merchants", exchange -> {
                AI_BODY.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                ArrayNode results = JSON.createArrayNode();
                for (JsonNode item : JSON.readTree(AI_BODY.get()).path("items")) {
                    results.add(((ObjectNode) JSON.readTree(AI_RESULT.get())).put("merchantNorm",
                        item.path("merchantNorm").asText()));
                }
                try {
                    Thread.sleep(AI_DELAY_MS.get());
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                byte[] body = JSON.writeValueAsBytes(
                    JSON.createObjectNode().put("model", "gpt-6-luna").set("results", results));
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            });
            // 느린 응답이 다음 테스트의 요청을 막지 않게 요청마다 스레드를 쓴다
            server.setExecutor(Executors.newCachedThreadPool());
            server.start();
            return server;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
