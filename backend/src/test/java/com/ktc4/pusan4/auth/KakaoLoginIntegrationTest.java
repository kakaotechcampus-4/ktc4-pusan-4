package com.ktc4.pusan4.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ktc4.pusan4.integration.RedisTestContainer;
import com.ktc4.pusan4.shared.api.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.context.ImportTestcontainers;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 카카오 로그인 (api.md 1.1). 카카오 호출은 KakaoClientTest 가 보고, 여기서는 KakaoClient 를 대신해 계정 처리를 본다.
 */
@SpringBootTest
@Testcontainers
@ImportTestcontainers(RedisTestContainer.class)
class KakaoLoginIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @MockitoBean
    private KakaoClient kakaoClient;

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void first_kakao_login_creates_account_without_email() throws Exception {
        given(kakaoClient.userId("code-new")).willReturn(1_001L);

        // when
        MvcResult result = kakaoLogin("code-new")
            .andExpect(status().isOk())
            .andReturn();

        // then: 로그인과 같은 응답이고, 카카오 계정은 이메일이 없다
        assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE)).startsWith("refresh_token=");
        mockMvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken(result)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value(nullValue()));
    }

    @Test
    void same_kakao_member_logs_into_same_account() throws Exception {
        given(kakaoClient.userId("code-a")).willReturn(2_002L);
        given(kakaoClient.userId("code-b")).willReturn(2_002L);

        String first = userId(kakaoLogin("code-a").andReturn());
        String second = userId(kakaoLogin("code-b").andReturn());

        assertThat(second).isEqualTo(first);
    }

    @Test
    void rejected_code_returns_invalid_kakao_code() throws Exception {
        given(kakaoClient.userId("used-code")).willThrow(
            new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_KAKAO_CODE", "카카오 로그인을 다시 시도해 주세요."));

        kakaoLogin("used-code")
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_KAKAO_CODE"));
    }

    private ResultActions kakaoLogin(String code) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/kakao").contentType(MediaType.APPLICATION_JSON)
            .content("{\"code\": \"%s\"}".formatted(code)));
    }

    private String userId(MvcResult login) throws Exception {
        String body = mockMvc.perform(get("/api/v1/users/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken(login)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("id").asText();
    }

    private String accessToken(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("accessToken").asText();
    }
}
