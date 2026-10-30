package com.ktc4.pusan4.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ktc4.pusan4.auth.RecordingVerificationMailSender;
import com.ktc4.pusan4.auth.TestUser;
import com.ktc4.pusan4.user.persistence.UserService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.context.ImportTestcontainers;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Locale;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 메일 인증·회원가입·로그인·재발급·로그아웃과 Bearer 확인 (api.md 1.1). 메일은 보내지 않고 코드를 기억해 둔다.
 * 다른 테스트처럼 기본 토큰이 실린 MockMvc 를 쓰면 인증 실패를 볼 수 없어서, 기본값 없는 MockMvc 를 직접 만든다.
 */
@SpringBootTest
@Testcontainers
@ImportTestcontainers(RedisTestContainer.class)
@Import(RecordingVerificationMailSender.Config.class)
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

    @Autowired
    private RecordingVerificationMailSender mailbox;

    @Autowired
    private UserService userService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
        // 로그인 테스트가 쓸 계정. 컨텍스트를 같이 쓰는 다른 테스트가 먼저 만들었으면 409 다
        int status = signup(MEMBER_EMAIL, "test-password").getResponse().getStatus();
        assertThat(status).isIn(201, 409);
    }

    @Test
    void verification_code_is_mailed_and_confirm_returns_token() throws Exception {
        // when
        sendCode("Verify@Example.com").andExpect(status().isNoContent());

        // then: 소문자 이메일로 6자리 코드가 간다
        String code = mailbox.lastCode("verify@example.com").orElseThrow();
        assertThat(code).matches("\\d{6}");
        confirmCode("verify@example.com", code)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.verificationToken").isNotEmpty());
    }

    @Test
    void resend_within_cooldown_returns_too_many_requests() throws Exception {
        sendCode("cooldown@example.com").andExpect(status().isNoContent());

        sendCode("cooldown@example.com")
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.code").value("VERIFICATION_RESEND_TOO_SOON"));
    }

    @Test
    void verification_for_registered_email_returns_conflict() throws Exception {
        sendCode("MEMBER@example.com")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_EXISTS"));
    }

    @Test
    void failed_mail_lets_user_request_again_right_away() throws Exception {
        // given
        mailbox.failNext();
        sendCode("mailfail@example.com")
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.code").value("EMAIL_SEND_FAILED"));

        // then: 재발송 대기가 풀려 있다
        sendCode("mailfail@example.com").andExpect(status().isNoContent());
    }

    @Test
    void wrong_code_is_rejected_and_five_misses_discard_it() throws Exception {
        sendCode("wrong@example.com").andExpect(status().isNoContent());
        String code = mailbox.lastCode("wrong@example.com").orElseThrow();
        String wrong = code.equals("000000") ? "111111" : "000000";

        // when: 다섯 번 틀린다
        for (int i = 0; i < 5; i++) {
            confirmCode("wrong@example.com", wrong)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_VERIFICATION_CODE"));
        }

        // then: 맞는 코드도 이제 쓸 수 없다
        confirmCode("wrong@example.com", code)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VERIFICATION_CODE_EXPIRED"));
    }

    @Test
    void signup_without_verification_returns_email_not_verified() throws Exception {
        MvcResult result = signupWithToken("unverified@example.com", "new-password", "not-a-token");

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getContentAsString()).contains("EMAIL_NOT_VERIFIED");
    }

    @Test
    void verification_token_works_only_for_its_email_and_only_once() throws Exception {
        String token = verificationToken("owner@example.com");

        // 다른 이메일에는 쓸 수 없다
        assertThat(signupWithToken("other@example.com", "new-password", token).getResponse().getStatus())
            .isEqualTo(400);
        // 가입하면 토큰은 지워진다
        assertThat(signupWithToken("owner@example.com", "new-password", token).getResponse().getStatus())
            .isEqualTo(201);
        assertThat(signupWithToken("owner@example.com", "new-password", token).getResponse().getContentAsString())
            .contains("EMAIL_NOT_VERIFIED");
    }

    @Test
    void signup_creates_account_and_logs_in() throws Exception {
        // when
        MvcResult result = signup("New@Example.com", "new-password");

        // then: 로그인과 같은 응답이고, 이메일은 소문자로 저장된다
        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE)).startsWith("refresh_token=");
        mockMvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken(result)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("new@example.com"));
    }

    @Test
    void signup_with_existing_email_in_other_case_returns_conflict() throws Exception {
        // 인증을 받아 둔 사이에 같은 이메일 계정이 생긴 경우다
        String token = verificationToken("late@example.com");
        assertThat(userService.registerEmailAccount("late@example.com", "already-hashed")).isPresent();

        MvcResult result = signupWithToken("LATE@example.com", "other-password", token);

        assertThat(result.getResponse().getStatus()).isEqualTo(409);
        assertThat(result.getResponse().getContentAsString()).contains("EMAIL_ALREADY_EXISTS");
    }

    @Test
    void signup_rejects_short_or_too_long_password() throws Exception {
        assertThat(signup("short@example.com", "1234567").getResponse().getStatus()).isEqualTo(400);
        // 25자지만 UTF-8 75바이트라 BCrypt 한계(72바이트)를 넘는다
        assertThat(signup("long@example.com", "가나다라마바사아자차카타파하가나다라마바사아자차카")
            .getResponse().getStatus()).isEqualTo(400);
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

    /** 메일 인증부터 가입까지. 이미 가입한 이메일이면 인증 요청의 409 를 그대로 돌려준다. */
    private MvcResult signup(String email, String password) throws Exception {
        MvcResult sent = sendCode(email).andReturn();
        if (sent.getResponse().getStatus() != 204) {
            return sent;
        }
        return signupWithToken(email, password, confirmedToken(email));
    }

    private MvcResult signupWithToken(String email, String password, String token) throws Exception {
        String body = objectMapper.writeValueAsString(
            Map.of("email", email, "password", password, "verificationToken", token));
        return mockMvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
            .andReturn();
    }

    private String verificationToken(String email) throws Exception {
        sendCode(email).andExpect(status().isNoContent());
        return confirmedToken(email);
    }

    private String confirmedToken(String email) throws Exception {
        String code = mailbox.lastCode(email.trim().toLowerCase(Locale.ROOT)).orElseThrow();
        MvcResult result = confirmCode(email, code).andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("verificationToken").asText();
    }

    private ResultActions sendCode(String email) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/email-verification").contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of("email", email))));
    }

    private ResultActions confirmCode(String email, String code)
        throws Exception {
        return mockMvc.perform(post("/api/v1/auth/email-verification/confirm").contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of("email", email, "code", code))));
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
