package com.ktc4.pusan4.shared.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ktc4.pusan4.auth.AuthService;
import com.ktc4.pusan4.auth.TestAuthentication;
import com.ktc4.pusan4.auth.TestUser;
import com.ktc4.pusan4.shared.UuidV7Generator;
import com.ktc4.pusan4.user.api.UserController;
import com.ktc4.pusan4.user.domain.AppUser;
import com.ktc4.pusan4.user.domain.UserRole;
import com.ktc4.pusan4.user.persistence.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 운영 로그(application.yml 의 logstash JSON)에 traceId·요청 로그가 계약(docs/monitoring_plan.md 트랙 사이 계약)대로 찍히는지 본다.
 * CloudWatch 메트릭 필터가 status 를 숫자로 비교하므로 숫자 필드인지도 확인한다.
 */
@WebMvcTest(UserController.class)
@Import({ApiExceptionHandler.class, UuidV7Generator.class, TestAuthentication.class})
@ExtendWith(OutputCaptureExtension.class)
class RequestTraceFilterTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private AuthService authService;

    @Test
    void server_error_trace_id_matches_header_body_and_logs(CapturedOutput output) throws Exception {
        // given
        given(userService.get(any())).willThrow(new IllegalStateException("boom"));

        // when
        MvcResult result = mockMvc.perform(get("/api/v1/users/me"))
            .andExpect(status().isInternalServerError())
            .andReturn();

        // then: 응답 헤더와 에러 본문의 traceId 가 같고, 그 traceId 로 에러 로그와 요청 로그를 찾을 수 있다
        String traceId = result.getResponse().getHeader("X-Trace-Id");
        assertThat(traceId).isNotBlank();
        assertThat(objectMapper.readTree(result.getResponse().getContentAsString()).get("traceId").asText())
            .isEqualTo(traceId);

        List<JsonNode> lines = logLines(output, traceId);
        JsonNode errorLog = lines.stream().filter(line -> "ERROR".equals(line.path("level").asText())).findFirst().orElseThrow();
        assertThat(errorLog.path("stack_trace").asText()).contains("boom");
        assertThat(errorLog.path("userId").asText()).isEqualTo(TestUser.ID.toString());

        JsonNode requestLog = requestLog(lines);
        assertThat(requestLog.path("status").isNumber()).isTrue();
        assertThat(requestLog.path("status").asInt()).isEqualTo(500);
    }

    @Test
    void api_exception_trace_id_matches_header(CapturedOutput output) throws Exception {
        // given: 404·409 같은 전용 코드 에러는 500 과 다른 핸들러(handleApiException)로 나간다
        given(userService.get(any())).willThrow(
            new ApiException(org.springframework.http.HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "없음"));

        // when
        MvcResult result = mockMvc.perform(get("/api/v1/users/me"))
            .andExpect(status().isNotFound())
            .andReturn();

        // then
        String traceId = result.getResponse().getHeader("X-Trace-Id");
        assertThat(objectMapper.readTree(result.getResponse().getContentAsString()).get("traceId").asText())
            .isEqualTo(traceId);
        assertThat(requestLog(logLines(output, traceId)).path("status").asInt()).isEqualTo(404);
    }

    @Test
    void request_log_has_contract_fields_without_query_string(CapturedOutput output) throws Exception {
        // given
        given(userService.get(any())).willReturn(new AppUser(
            TestUser.ID, TestUser.EMAIL, UserRole.USER, OffsetDateTime.parse("2026-09-01T10:00:00+09:00")));

        // when
        MvcResult result = mockMvc.perform(get("/api/v1/users/me").queryParam("q", "secret"))
            .andExpect(status().isOk())
            .andReturn();

        // then
        JsonNode requestLog = requestLog(logLines(output, result.getResponse().getHeader("X-Trace-Id")));
        assertThat(requestLog.path("method").asText()).isEqualTo("GET");
        assertThat(requestLog.path("path").asText()).isEqualTo("/api/v1/users/me");
        assertThat(requestLog.path("status").asInt()).isEqualTo(200);
        assertThat(requestLog.path("durationMs").isNumber()).isTrue();
        assertThat(requestLog.path("userId").asText()).isEqualTo(TestUser.ID.toString());
        assertThat(output.getOut()).doesNotContain("secret");
    }

    @Test
    void unauthenticated_request_is_logged_without_user_id(CapturedOutput output) throws Exception {
        // when
        MvcResult result = mockMvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer wrong"))
            .andExpect(status().isUnauthorized())
            .andReturn();

        // then
        JsonNode requestLog = requestLog(logLines(output, result.getResponse().getHeader("X-Trace-Id")));
        assertThat(requestLog.path("status").asInt()).isEqualTo(401);
        assertThat(requestLog.has("userId")).isFalse();
    }

    @Test
    void actuator_request_is_logged_only_when_not_successful(CapturedOutput output) throws Exception {
        // given: DB 가 끊기면 health 가 503 이다. 요청이 없는 시간에는 이 줄이 5xx 알람의 유일한 신호다
        RequestTraceFilter filter = new RequestTraceFilter(new UuidV7Generator());
        MockHttpServletResponse healthy = actuatorHealth(filter, 200);
        MockHttpServletResponse down = actuatorHealth(filter, 503);

        // then: 성공한 healthcheck 는 남기지 않는다
        assertThat(output.getOut()).doesNotContain(healthy.getHeader("X-Trace-Id"));
        JsonNode requestLog = requestLog(logLines(output, down.getHeader("X-Trace-Id")));
        assertThat(requestLog.path("path").asText()).isEqualTo("/actuator/health");
        assertThat(requestLog.path("status").asInt()).isEqualTo(503);
    }

    private static MockHttpServletResponse actuatorHealth(RequestTraceFilter filter, int status) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("GET", "/actuator/health"), response,
            (request, chainResponse) -> ((MockHttpServletResponse) chainResponse).setStatus(status));
        return response;
    }

    private List<JsonNode> logLines(CapturedOutput output, String traceId) {
        List<JsonNode> lines = output.getOut().lines()
            .filter(line -> line.startsWith("{"))
            .map(this::parse)
            .filter(line -> traceId.equals(line.path("traceId").asText()))
            .toList();
        assertThat(lines).isNotEmpty();
        return lines;
    }

    private static JsonNode requestLog(List<JsonNode> lines) {
        return lines.stream()
            .filter(line -> line.path("logger_name").asText().endsWith("RequestTraceFilter"))
            .findFirst()
            .orElseThrow();
    }

    private JsonNode parse(String line) {
        try {
            return objectMapper.readTree(line);
        } catch (java.io.IOException e) {
            throw new IllegalStateException(line, e);
        }
    }
}
