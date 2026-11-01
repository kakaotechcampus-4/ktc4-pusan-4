package com.ktc4.pusan4.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ktc4.pusan4.auth.TestUser;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.context.ImportTestcontainers;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
 * 회원가입·로그인·재발급·로그아웃과 Bearer 확인 (api.md 1.1).
 * 다른 테스트처럼 기본 토큰이 실린 MockMvc 를 쓰면 인증 실패를 볼 수 없어서, 기본값 없는 MockMvc 를 직접 만든다.
 */
@SpringBootTest
@Testcontainers
@ImportTestcontainers(RedisTestContainer.class)
class AuthIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final String MEMBER_EMAIL = "member@example.com";
    private static final String LOGIN_BODY = """
        {"email": "member@example.com", "password": "test-password"}
        """;

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
        // 로그인 테스트가 쓸 계정. 컨텍스트를 같이 쓰는 다른 테스트가 먼저 만들었으면 409 다
        int status = signup(LOGIN_BODY).getResponse().getStatus();
        assertThat(status).isIn(201, 409);
    }

    @Test
    void signup_creates_account_and_logs_in() throws Exception {
        // when
        MvcResult result = signup("""
            {"email": "New@Example.com", "password": "new-password"}
            """);

        // then: 로그인과 같은 응답이고, 이메일은 소문자로 저장된다
        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE)).startsWith("refresh_token=");
        mockMvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken(result)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("new@example.com"));
    }

    @Test
    void signup_with_existing_email_in_other_case_returns_conflict() throws Exception {
        MvcResult result = signup("""
            {"email": "MEMBER@example.com", "password": "other-password"}
            """);

        assertThat(result.getResponse().getStatus()).isEqualTo(409);
        assertThat(result.getResponse().getContentAsString()).contains("EMAIL_ALREADY_EXISTS");
    }

    @Test
    void signup_rejects_short_or_too_long_password() throws Exception {
        assertThat(signup("""
            {"email": "short@example.com", "password": "1234567"}
            """).getResponse().getStatus()).isEqualTo(400);
        // 25자지만 UTF-8 75바이트라 BCrypt 한계(72바이트)를 넘는다
        assertThat(signup("""
            {"email": "long@example.com", "password": "가나다라마바사아자차카타파하가나다라마바사아자차카"}
            """).getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    void login_finds_email_regardless_of_case() throws Exception {
        assertThat(login("""
            {"email": "MEMBER@EXAMPLE.COM", "password": "test-password"}
            """).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void account_without_password_cannot_log_in() throws Exception {
        // 테스트 기본 사용자처럼 비밀번호가 없는 행(예전 고정 사용자)은 어떤 비밀번호로도 들어올 수 없다
        assertThat(login("""
            {"email": "%s", "password": "any-password"}
            """.formatted(TestUser.EMAIL)).getResponse().getStatus()).isEqualTo(401);
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
            .andExpect(jsonPath("$.email").value(MEMBER_EMAIL));
    }

    @Test
    void wrong_password_returns_invalid_credentials() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email": "member@example.com", "password": "wrong-password"}
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
    void reusing_rotated_refresh_cookie_logs_out_that_login() throws Exception {
        // given: 재발급으로 old → next 가 됐다
        Cookie old = refreshCookie(login(LOGIN_BODY));
        Cookie next = refreshCookie(mockMvc.perform(post("/api/v1/auth/refresh").cookie(old)).andReturn());

        // when: 이미 쓴 old 를 다시 보낸다 (탈취된 토큰을 쓴 경우)
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(old))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_REFRESH_TOKEN"));

        // then: 그 로그인이 끊겨 next 도 쓸 수 없다
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(next))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void logout_revokes_refresh_token_but_keeps_other_logins() throws Exception {
        Cookie loggedOut = refreshCookie(login(LOGIN_BODY));
        Cookie otherDevice = refreshCookie(login(LOGIN_BODY));

        // when
        mockMvc.perform(post("/api/v1/auth/logout").cookie(loggedOut)).andExpect(status().isNoContent());

        // then
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(loggedOut))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(otherDevice))
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

    private MvcResult signup(String body) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
            .andReturn();
    }

    private MvcResult login(String body) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
            .andReturn();
    }

    private String accessToken(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("accessToken").asText();
    }

    private static Cookie refreshCookie(MvcResult result) {
        Cookie cookie = result.getResponse().getCookie("refresh_token");
        assertThat(cookie).isNotNull();
        return cookie;
    }
}
