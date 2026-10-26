package com.ktc4.pusan4.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.ktc4.pusan4.shared.api.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * 카카오 로그인 REST API (developers.kakao.com 카카오 로그인 > REST API).
 * 프론트가 받은 인가 코드를 토큰으로 바꾸고, 그 토큰으로 카카오 회원번호를 읽는다. 카카오 토큰은 저장하지 않는다.
 *
 * <p>redirect_uri 는 프론트가 인가를 요청할 때 쓴 값과 같아야 해서 환경별 설정으로 둔다.
 */
@Component
class KakaoClient {

    static final String TOKEN_URL = "https://kauth.kakao.com/oauth/token";
    static final String USER_URL = "https://kapi.kakao.com/v2/user/me";

    private final RestClient restClient;
    private final String restApiKey;
    private final String clientSecret;
    private final String redirectUri;

    KakaoClient(
        RestClient.Builder kakaoRestClientBuilder,
        @Value("${app.auth.kakao.rest-api-key}") String restApiKey,
        @Value("${app.auth.kakao.client-secret}") String clientSecret,
        @Value("${app.auth.kakao.redirect-uri}") String redirectUri
    ) {
        this.restClient = kakaoRestClientBuilder.build();
        this.restApiKey = restApiKey;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }

    /**
     * 인가 코드의 카카오 회원번호.
     *
     * @throws ApiException 키가 설정되지 않았으면 503 KAKAO_LOGIN_UNAVAILABLE, 코드가 틀렸거나 이미 썼으면
     *                      401 INVALID_KAKAO_CODE, 카카오가 응답하지 않으면 502 KAKAO_UNAVAILABLE
     */
    long userId(String code) {
        if (restApiKey.isBlank() || redirectUri.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "KAKAO_LOGIN_UNAVAILABLE",
                "지금은 카카오 로그인을 쓸 수 없습니다.");
        }
        try {
            String accessToken = accessToken(code);
            JsonNode me = restClient.get()
                .uri(USER_URL)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .retrieve()
                .body(JsonNode.class);
            if (me == null || !me.path("id").canConvertToLong()) {
                throw new IllegalStateException("카카오 사용자 정보에 id 가 없다");
            }
            return me.path("id").asLong();
        } catch (HttpClientErrorException e) {
            // 토큰 요청의 4xx: 코드가 틀렸거나 만료됐거나 이미 썼다(KOE320 등), redirect_uri 가 다르다
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_KAKAO_CODE", "카카오 로그인을 다시 시도해 주세요.");
        } catch (RestClientException | IllegalStateException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "KAKAO_UNAVAILABLE",
                "카카오와 통신하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
        }
    }

    private String accessToken(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", restApiKey);
        form.add("redirect_uri", redirectUri);
        form.add("code", code);
        if (!clientSecret.isBlank()) {
            form.add("client_secret", clientSecret);
        }
        JsonNode token = restClient.post()
            .uri(TOKEN_URL)
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(form)
            .retrieve()
            .body(JsonNode.class);
        if (token == null || !token.hasNonNull("access_token")) {
            throw new IllegalStateException("카카오 토큰 응답에 access_token 이 없다");
        }
        return token.get("access_token").asText();
    }
}
