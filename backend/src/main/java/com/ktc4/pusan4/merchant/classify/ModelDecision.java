package com.ktc4.pusan4.merchant.classify;

import java.util.List;

/**
 * 분류 모델이 가맹점 하나에 낸 답 (AI 서버 POST /classify/merchants 의 results[] 한 칸).
 *
 * @param category    top-1 카테고리. 거절했거나 고르지 못했으면 {@code null}
 * @param confidence  top-1 확률(0~1). 응답이 소수 둘째 자리로 반올림돼 온다
 * @param known       모델이 이 가맹점을 안다고 본 확률(0~1). 없으면 {@code null}
 * @param suggestions 후보 카테고리. 허용 어휘 밖의 값이 섞여 올 수 있다
 * @param refused     모델이 답을 거절했는지
 * @param model       답한 모델 id
 */
public record ModelDecision(
        String category,
        double confidence,
        Double known,
        List<String> suggestions,
        boolean refused,
        String model
) {
}
