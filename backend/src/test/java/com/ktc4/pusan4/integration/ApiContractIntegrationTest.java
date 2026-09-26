package com.ktc4.pusan4.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Set;
import java.util.TreeSet;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 스웨거 명세가 docs/api.md 의 API Tree 와 같은 엔드포인트를 갖는지 확인한다.
 * 계약에 엔드포인트가 추가되면 CONTRACT 에도 추가한다.
 */
@SpringBootTest(properties = "springdoc.api-docs.enabled=true")
@AutoConfigureMockMvc
@Testcontainers
class ApiContractIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final Set<String> HTTP_METHODS = Set.of("get", "post", "put", "patch", "delete");

    private static final Set<String> CONTRACT = Set.of(
        "GET /api/v1/users/me",
        "DELETE /api/v1/users/me",
        "POST /api/v1/users/me/contexts",
        "GET /api/v1/users/me/contexts",
        "GET /api/v1/users/me/contexts/current",
        "POST /api/v1/upload-batches",
        "GET /api/v1/upload-batches",
        "GET /api/v1/upload-batches/{batchId}",
        "DELETE /api/v1/upload-batches/{batchId}",
        "GET /api/v1/transactions",
        "GET /api/v1/transactions/{transactionId}",
        "POST /api/v1/transactions/{transactionId}/include",
        "POST /api/v1/transactions/{transactionId}/exclude",
        "GET /api/v1/classification-reviews",
        "POST /api/v1/classification-responses",
        "POST /api/v1/judgment-runs",
        "GET /api/v1/judgment-runs/{runId}",
        "GET /api/v1/judgment-runs/{runId}/failures",
        "GET /api/v1/judgments",
        "GET /api/v1/judgments/summary",
        "GET /api/v1/judgments/{judgmentId}",
        "POST /api/v1/judgments/{judgmentId}/override",
        "DELETE /api/v1/judgment-overrides/{overrideId}",
        "GET /api/v1/questions",
        "POST /api/v1/questions/bulk-answer",
        "POST /api/v1/question-responses",
        "GET /api/v1/statutes/{statuteVersionId}"
    );

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void openapi_paths_match_api_md_contract() throws Exception {
        String body = mockMvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        Set<String> actual = new TreeSet<>();
        objectMapper.readTree(body).path("paths").fields().forEachRemaining(path -> {
            JsonNode operations = path.getValue();
            operations.fieldNames().forEachRemaining(method -> {
                if (HTTP_METHODS.contains(method)) {
                    actual.add(method.toUpperCase() + " " + path.getKey());
                }
            });
        });

        assertThat(actual).containsExactlyInAnyOrderElementsOf(CONTRACT);
    }
}
