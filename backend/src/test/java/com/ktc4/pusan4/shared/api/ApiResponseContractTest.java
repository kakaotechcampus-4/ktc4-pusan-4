package com.ktc4.pusan4.shared.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ktc4.pusan4.judgment.api.JudgmentMockData;
import com.ktc4.pusan4.merchant.api.ClassificationMockData;
import com.ktc4.pusan4.shared.UuidV7Generator;
import com.ktc4.pusan4.transaction.api.TransactionMockData;
import com.ktc4.pusan4.user.api.UserMockData;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 서비스 레이어가 붙기 전까지 컨트롤러는 고정된 목 응답을 반환한다.
 * 목 응답이 api.md 의 상태 코드를 지키는지 확인한다. 값은 보지 않는다 — 서비스로 바꿔도 깨지지 않아야 한다.
 */
@WebMvcTest
@Import({ApiExceptionHandler.class, UuidV7Generator.class,
    UserMockData.class, TransactionMockData.class, ClassificationMockData.class, JudgmentMockData.class})
class ApiResponseContractTest {

    private static final String ID = "0199c8f2-0000-7000-8000-000000000001";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    static Stream<Arguments> endpoints() {
        return Stream.of(
            Arguments.of("GET", "/api/v1/users/me", null, 200),
            Arguments.of("DELETE", "/api/v1/users/me", null, 204),
            Arguments.of("POST", "/api/v1/users/me/contexts", """
                {"industryCode": "62010", "prevYearRevenue": 82000000, "businessOpenDate": "2024-03-15",
                 "bookkeepingDuty": "간편장부", "hasEmployee": false, "homeOfficeRatio": 20}
                """, 201),
            Arguments.of("GET", "/api/v1/users/me/contexts", null, 200),
            Arguments.of("GET", "/api/v1/users/me/contexts/current", null, 200),
            Arguments.of("POST", "/api/v1/upload-batches", """
                {"sourceType": "승인내역", "cardIssuer": "국민", "periodStart": "2026-01-01",
                 "periodEnd": "2026-01-31", "fileHash": "sha256:abc",
                 "transactions": [{"approvedAt": "2026-01-03", "merchantRaw": "스타벅스코리아 서면점",
                   "amount": 11000, "naturalKey": "74af71c3d9e2b018", "status": "JUDGEABLE"}]}
                """, 201),
            Arguments.of("GET", "/api/v1/upload-batches", null, 200),
            Arguments.of("GET", "/api/v1/upload-batches/" + ID, null, 200),
            Arguments.of("DELETE", "/api/v1/upload-batches/" + ID, null, 204),
            Arguments.of("GET", "/api/v1/transactions", null, 200),
            Arguments.of("GET", "/api/v1/transactions/" + ID, null, 200),
            Arguments.of("POST", "/api/v1/transactions/" + ID + "/include", null, 200),
            Arguments.of("POST", "/api/v1/transactions/" + ID + "/exclude", null, 200),
            Arguments.of("GET", "/api/v1/classification-reviews", null, 200),
            Arguments.of("GET", "/api/v1/classification-reviews?grouped=true", null, 200),
            Arguments.of("POST", "/api/v1/classification-responses", """
                {"reviewIds": ["%s"], "merchantCategory": "해외SaaS"}
                """.formatted(ID), 200),
            Arguments.of("POST", "/api/v1/judgment-runs", """
                {"batchId": "%s", "contextId": "%s"}
                """.formatted(ID, ID), 202),
            Arguments.of("GET", "/api/v1/judgment-runs/" + ID, null, 200),
            Arguments.of("GET", "/api/v1/judgment-runs/" + ID + "/failures", null, 200),
            Arguments.of("GET", "/api/v1/judgments?batchId=" + ID, null, 200),
            Arguments.of("GET", "/api/v1/judgments/summary?batchId=" + ID, null, 200),
            Arguments.of("GET", "/api/v1/judgments/" + ID, null, 200),
            Arguments.of("POST", "/api/v1/judgments/" + ID + "/override", """
                {"toVerdict": "UNAVAILABLE", "reason": "개인적으로 사용한 비용입니다."}
                """, 200),
            Arguments.of("DELETE", "/api/v1/judgment-overrides/" + ID, null, 204),
            Arguments.of("GET", "/api/v1/questions?batchId=" + ID, null, 200),
            Arguments.of("GET", "/api/v1/questions?batchId=" + ID + "&grouped=true", null, 200),
            Arguments.of("POST", "/api/v1/questions/bulk-answer", """
                {"batchId": "%s", "factType": "용도", "answer": {"value": "사업"}}
                """.formatted(ID), 200),
            Arguments.of("POST", "/api/v1/question-responses", """
                {"questionIds": ["%s"], "answer": {"value": "사업"}}
                """.formatted(ID), 200),
            Arguments.of("GET", "/api/v1/statutes/1523", null, 200)
        );
    }

    @ParameterizedTest(name = "{0} {1} -> {3}")
    @MethodSource("endpoints")
    void endpoint_returns_documented_status_with_mock_response(
        String method, String path, String body, int expectedStatus
    ) throws Exception {
        // given
        MockHttpServletRequestBuilder request = request(HttpMethod.valueOf(method), path)
            // 업로드만 필요로 하지만, 다른 API 는 모르는 헤더를 무시하므로 모두에 붙인다
            .header("Idempotency-Key", ID);
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(body);
        }

        // when / then
        mockMvc.perform(request).andExpect(status().is(expectedStatus));
    }

    private static final Set<String> CONTEXT_KEYS = Set.of("id", "userId", "version", "industryCode",
        "prevYearRevenue", "businessOpenDate", "bookkeepingDuty", "hasEmployee", "homeOfficeRatio", "createdAt");
    private static final Set<String> UPLOAD_BATCH_KEYS = Set.of("id", "sourceType", "cardIssuer", "periodStart",
        "periodEnd", "transactionCount", "skippedDuplicateCount", "classificationPendingCount", "createdAt");
    private static final Set<String> JUDGMENT_KEYS = Set.of("id", "transactionId", "revision", "origin", "verdict",
        "outOfScope", "blockedAtGate", "account", "finalAmount", "isInference", "unmatchedReason", "attributes",
        "ruleCardId", "ruleCardVersion", "appliedRuleIds", "rulesCommitSha", "userContextVersion", "explanation",
        "computedAt", "citations");
    private static final Set<String> QUESTION_KEYS = Set.of("id", "batchId", "transactionId", "groupKey", "factType",
        "questionText", "options", "status", "answeredFactId", "createdAt", "answeredAt");
    private static final Set<String> CLASSIFICATION_REVIEW_KEYS = Set.of("id", "batchId", "transactionId",
        "merchantRaw", "merchantNorm", "status", "suggestedCategories", "createdAt", "resolvedAt");

    /**
     * 응답 타입이 Map 이던 자리. 키 집합은 api.md 의 응답 예시에서 옮겼다.
     */
    static Stream<Arguments> documentedShapes() {
        return Stream.of(
            Arguments.of("/api/v1/users/me/contexts/current", "", CONTEXT_KEYS),
            Arguments.of("/api/v1/users/me/contexts", "/0", CONTEXT_KEYS),
            Arguments.of("/api/v1/upload-batches", "/items/0", UPLOAD_BATCH_KEYS),
            Arguments.of("/api/v1/upload-batches/" + ID, "", UPLOAD_BATCH_KEYS),
            Arguments.of("/api/v1/judgments?batchId=" + ID, "/items/0", JUDGMENT_KEYS),
            Arguments.of("/api/v1/questions?batchId=" + ID, "/items/0", QUESTION_KEYS),
            Arguments.of("/api/v1/classification-reviews", "/items/0", CLASSIFICATION_REVIEW_KEYS)
        );
    }

    @ParameterizedTest(name = "{0} {1}")
    @MethodSource("documentedShapes")
    void response_has_same_fields_as_api_md_example(String path, String pointer, Set<String> expectedKeys)
        throws Exception {
        // when
        String body = mockMvc.perform(get(path))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        // then
        Set<String> actualKeys = new TreeSet<>();
        objectMapper.readTree(body).at(pointer).fieldNames().forEachRemaining(actualKeys::add);
        assertThat(actualKeys).containsExactlyInAnyOrderElementsOf(expectedKeys);
    }

    @Test
    void invalid_request_returns_error_format_before_mock_response() throws Exception {
        // given: 필수 필드가 모두 빠진 문진
        MockHttpServletRequestBuilder request = request(HttpMethod.POST, "/api/v1/users/me/contexts")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}");

        // when / then
        mockMvc.perform(request)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
            .andExpect(jsonPath("$.message").isNotEmpty())
            .andExpect(jsonPath("$.traceId").isNotEmpty());
    }

    @Test
    void upload_without_idempotency_key_returns_idempotency_key_required() throws Exception {
        // given
        MockHttpServletRequestBuilder request = request(HttpMethod.POST, "/api/v1/upload-batches")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}");

        // when / then: api.md 3.3
        mockMvc.perform(request)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REQUIRED"));
    }

    @ParameterizedTest(name = "summary{0}")
    @MethodSource("invalidSummaryScopes")
    void summary_without_exactly_one_scope_returns_invalid_summary_scope(String query) throws Exception {
        // when / then: api.md 3.7 — batchId, year, runId 중 정확히 하나
        mockMvc.perform(get("/api/v1/judgments/summary" + query))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_SUMMARY_SCOPE"));
    }

    @Test
    void unknown_path_returns_common_not_found_code() throws Exception {
        // when / then: api.md 1.3 — 전용 *_NOT_FOUND 가 없는 경로는 NOT_FOUND
        mockMvc.perform(get("/api/v1/no-such-resource"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("NOT_FOUND"))
            .andExpect(jsonPath("$.traceId").isNotEmpty());
    }

    static Stream<String> invalidSummaryScopes() {
        return Stream.of("", "?batchId=" + ID + "&year=2026", "?batchId=" + ID + "&year=2026&runId=" + ID);
    }
}
