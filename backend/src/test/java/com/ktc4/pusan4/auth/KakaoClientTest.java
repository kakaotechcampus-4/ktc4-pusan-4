package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.shared.api.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class KakaoClientTest {

    private static final String REDIRECT_URI = "https://app.test/auth/kakao/callback";

    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();

    @Test
    void exchanges_code_and_reads_kakao_member_id() {
        // given
        server.expect(requestTo(KakaoClient.TOKEN_URL))
            .andExpect(method(HttpMethod.POST))
            .andExpect(content().formDataContains(Map.of(
                "grant_type", "authorization_code",
                "client_id", "rest-key",
                "redirect_uri", REDIRECT_URI,
                "code", "code-1",
                "client_secret", "secret")))
            .andRespond(withSuccess("""
                {"token_type": "bearer", "access_token": "kakao-access", "expires_in": 21599}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(KakaoClient.USER_URL))
            .andExpect(method(HttpMethod.GET))
            .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer kakao-access"))
            .andRespond(withSuccess("""
                {"id": 4011223344, "connected_at": "2026-10-26T07:00:00Z"}
                """, MediaType.APPLICATION_JSON));

        // when
        long id = client("rest-key", "secret").userId("code-1");

        // then
        assertThat(id).isEqualTo(4_011_223_344L);
        server.verify();
    }

    @Test
    void omits_client_secret_when_not_set() {
        server.expect(requestTo(KakaoClient.TOKEN_URL))
            .andExpect(content().string(not(containsString("client_secret"))))
            .andRespond(withSuccess("{\"access_token\": \"kakao-access\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(KakaoClient.USER_URL))
            .andRespond(withSuccess("{\"id\": 1}", MediaType.APPLICATION_JSON));

        assertThat(client("rest-key", "").userId("code-1")).isEqualTo(1L);
    }

    @Test
    void rejected_code_is_invalid_kakao_code() {
        // 이미 쓴 코드는 400 invalid_grant(KOE320)로 온다
        server.expect(requestTo(KakaoClient.TOKEN_URL))
            .andRespond(withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON)
                .body("{\"error\": \"invalid_grant\", \"error_code\": \"KOE320\"}"));

        assertThatThrownBy(() -> client("rest-key", "").userId("used-code"))
            .isInstanceOfSatisfying(ApiException.class, e -> {
                assertThat(e.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
                assertThat(e.getCode()).isEqualTo("INVALID_KAKAO_CODE");
            });
    }

    @Test
    void kakao_server_error_is_bad_gateway() {
        server.expect(requestTo(KakaoClient.TOKEN_URL)).andRespond(withServerError());

        assertThatThrownBy(() -> client("rest-key", "").userId("code-1"))
            .isInstanceOfSatisfying(ApiException.class, e -> {
                assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY);
                assertThat(e.getCode()).isEqualTo("KAKAO_UNAVAILABLE");
            });
    }

    @Test
    void missing_key_is_unavailable_without_calling_kakao() {
        assertThatThrownBy(() -> client("", "").userId("code-1"))
            .isInstanceOfSatisfying(ApiException.class, e -> {
                assertThat(e.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                assertThat(e.getCode()).isEqualTo("KAKAO_LOGIN_UNAVAILABLE");
            });
        server.verify();
    }

    private KakaoClient client(String restApiKey, String clientSecret) {
        return new KakaoClient(builder, restApiKey, clientSecret, REDIRECT_URI);
    }
}
