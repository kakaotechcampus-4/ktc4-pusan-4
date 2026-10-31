package com.ktc4.pusan4.assistant;

import com.ktc4.pusan4.assistant.api.ChatRequest;
import com.ktc4.pusan4.assistant.api.ChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;

/**
 * AI 서버 POST /assistant/chat (agent-secretary.md 9장). AI 서버는 내부망에만 있다(C-8).
 * 사용자의 Authorization 헤더만 넘긴다. AI 서버의 조회 도구가 이 토큰으로 공개 API 를 불러 사용자 권한 밖을 읽지 못한다.
 */
@Component
class AssistantClient {

    private final RestClient restClient;

    AssistantClient(
        @Value("${app.assistant.base-url}") String baseUrl,
        @Value("${app.assistant.connect-timeout}") Duration connectTimeout,
        @Value("${app.assistant.read-timeout}") Duration readTimeout
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeout);
        requestFactory.setReadTimeout(readTimeout);
        this.restClient = RestClient.builder().baseUrl(baseUrl).requestFactory(requestFactory).build();
    }

    ChatResponse chat(String authorization, ChatRequest request) {
        try {
            return restClient.post()
                .uri("/assistant/chat")
                .header(HttpHeaders.AUTHORIZATION, authorization)
                .body(request)
                .retrieve()
                .body(ChatResponse.class);
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().isSameCodeAs(HttpStatus.TOO_MANY_REQUESTS)) {
                // AI 서버 전체 동시 실행 한도(8턴)에 걸렸다.
                throw AssistantRateLimiter.limitedByAssistantServer(
                    e.getResponseHeaders() == null ? null : e.getResponseHeaders().getFirst(HttpHeaders.RETRY_AFTER));
            }
            throw AssistantErrors.unavailable();
        } catch (RestClientException e) {
            // 연결 실패, 타임아웃, 응답 해석 실패
            throw AssistantErrors.unavailable();
        }
    }
}
