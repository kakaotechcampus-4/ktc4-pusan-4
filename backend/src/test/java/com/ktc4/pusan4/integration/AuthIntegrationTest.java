package com.ktc4.pusan4.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ktc4.pusan4.shared.auth.FixedUser;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 로그인·재발급·로그아웃과 Bearer 확인 (api.md 1.1).
 * 다른 테스트처럼 기본 토큰이 실린 MockMvc 를 쓰면 인증 실패를 볼 수 없어서, 기본값 없는 MockMvc 를 직접 만든다.
 */
@SpringBootTest(properties = "app.auth.demo-password=test-password")
@Testcontainers
class AuthIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final String LOGIN_BODY = """
        {"email": "demo@example.com", "password": "test-password"}
        """;

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void login_returns_access_token_and_refresh_cookie() throws Exception {
        // when
        MvcResult result = login(LOGIN_BODY);

        // then: 쿠키 모양은 api.md 1.1
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        String setCookie = result.getResponse().getHeader(HttpHeaders.SET_COOKIE);
        assertThat(setCookie).startsWith("refresh_token=")
            .contains("Path=/api/v1/auth", "HttpOnly", "SameSite=Strict", "Max-Age=1209600")
            .doesNotContain("Domain=");

        // 받은 액세스 토큰으로 API 를 부를 수 있다
        mockMvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken(result)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(FixedUser.ID.toString()));
    }

    @Test
    void new_email_with_demo_password_creates_user_and_logs_in() throws Exception {
        // when: 처음 보는 이메일
        MvcResult first = login("""
            {"email": "Visitor1@Demo.test", "password": "test-password"}
            """);

        // then: 새 사용자가 생기고 이메일은 소문자로 저장된다
        assertThat(first.getResponse().getStatus()).isEqualTo(200);
        String id = objectMapper.readTree(mockMvc.perform(get("/api/v1/users/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken(first)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("visitor1@demo.test"))
            .andReturn().getResponse().getContentAsString()).path("id").asText();
        assertThat(id).isNotEqualTo(FixedUser.ID.toString());

        // 같은 이메일(대소문자 무관)로 다시 들어오면 같은 사용자다
        MvcResult again = login("""
            {"email": "visitor1@demo.test", "password": "test-password"}
            """);
        mockMvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken(again)))
            .andExpect(jsonPath("$.id").value(id));
    }

    @Test
    void new_email_with_wrong_password_creates_nothing() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email": "visitor2@demo.test", "password": "wrong"}
                    """))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        assertThat(userCount("visitor2@demo.test")).isZero();
    }

    @Test
    void wrong_password_returns_invalid_credentials() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email": "demo@example.com", "password": "wrong"}
                    """))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void api_without_token_returns_unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/users/me"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
            .andExpect(jsonPath("$.traceId").isNotEmpty());
    }

    @Test
    void api_without_current_user_parameter_is_also_protected() throws Exception {
        // 거래 목록은 아직 목 응답이라 CurrentUser 인자가 없다. 인터셉터가 막아야 한다
        mockMvc.perform(get("/api/v1/transactions"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void invalid_token_returns_unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer not-a-jwt"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void refresh_cookie_cannot_be_used_as_bearer() throws Exception {
        String refreshToken = refreshCookie(login(LOGIN_BODY)).getValue();

        mockMvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + refreshToken))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void refresh_with_cookie_issues_new_tokens() throws Exception {
        Cookie cookie = refreshCookie(login(LOGIN_BODY));

        // when
        MvcResult result = mockMvc.perform(post("/api/v1/auth/refresh").cookie(cookie))
            .andExpect(status().isOk())
            .andReturn();

        // then
        assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE)).startsWith("refresh_token=");
        mockMvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken(result)))
            .andExpect(status().isOk());
    }

    @Test
    void refresh_without_cookie_returns_invalid_refresh_token() throws Exception {
        mockMvc.perform(post("/api/v1/auth/refresh"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_REFRESH_TOKEN"));
    }

    @Test
    void logout_clears_refresh_cookie() throws Exception {
        Cookie cookie = refreshCookie(login(LOGIN_BODY));

        MvcResult result = mockMvc.perform(post("/api/v1/auth/logout").cookie(cookie))
            .andExpect(status().isNoContent())
            .andReturn();

        assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE))
            .startsWith("refresh_token=;")
            .contains("Max-Age=0", "Path=/api/v1/auth");
    }

    @Test
    void health_stays_public() throws Exception {
        mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    private MvcResult login(String body) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
            .andReturn();
    }

    private String accessToken(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("accessToken").asText();
    }

    private int userCount(String email) {
        return jdbcTemplate.queryForObject("select count(*) from app_user where email = ?", Integer.class, email);
    }

    private static Cookie refreshCookie(MvcResult result) {
        Cookie cookie = result.getResponse().getCookie("refresh_token");
        assertThat(cookie).isNotNull();
        return cookie;
    }
}
