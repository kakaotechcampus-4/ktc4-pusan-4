package com.ktc4.pusan4.merchant.classify;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * AI 서버 POST /classify/merchants. AI 서버는 내부망에만 있다(C-8).
 * 결과는 요청과 같은 순서이고, {@code null} 칸은 그 가맹점이 실패했거나 AI 서버의 마감(8초)을 넘긴 것이다.
 * 어떤 실패든 빈 맵을 돌려주고 WARN 한 줄만 남긴다. 로그에 가맹점 이름은 넣지 않는다.
 */
@Component
class AiServerModelClassifier implements ModelClassifier {

    private static final Logger log = LoggerFactory.getLogger(AiServerModelClassifier.class);

    private final RestClient restClient;

    AiServerModelClassifier(
        @Value("${app.classify.base-url}") String baseUrl,
        @Value("${app.classify.connect-timeout}") Duration connectTimeout,
        @Value("${app.classify.read-timeout}") Duration readTimeout
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeout);
        requestFactory.setReadTimeout(readTimeout);
        this.restClient = RestClient.builder().baseUrl(baseUrl).requestFactory(requestFactory).build();
    }

    @Override
    public Map<String, ModelDecision> classify(List<Merchant> merchants) {
        try {
            Response response = restClient.post()
                .uri("/classify/merchants")
                .body(new Request(merchants))
                .retrieve()
                .body(Response.class);
            Objects.requireNonNull(response.model(), "model");
            if (response.results().size() != merchants.size()) {
                throw new IllegalStateException("results 길이가 요청과 다르다");
            }
            Map<String, ModelDecision> decisions = new HashMap<>();
            for (int i = 0; i < merchants.size(); i++) {
                Result result = response.results().get(i);
                if (result != null) {
                    decisions.put(merchants.get(i).merchantNorm(), new ModelDecision(result.category(),
                        result.confidence(), result.known(),
                        result.suggestions() == null ? List.of() : result.suggestions(), result.refused(),
                        response.model()));
                }
            }
            return decisions;
        } catch (RuntimeException e) {
            // 연결 실패, 타임아웃, 4xx·5xx(503 CLASSIFY_UNAVAILABLE 포함), 응답 모양이 다름
            log.warn("분류 모델 호출 실패. 가맹점 {}개를 모델 없이 업로드한다: {}", merchants.size(),
                e.getClass().getSimpleName());
            return Map.of();
        }
    }

    private record Request(List<Merchant> items) {
    }

    private record Response(String model, List<Result> results) {
    }

    private record Result(
        String merchantNorm,
        String category,
        double confidence,
        Double known,
        List<String> suggestions,
        boolean refused
    ) {
    }
}
