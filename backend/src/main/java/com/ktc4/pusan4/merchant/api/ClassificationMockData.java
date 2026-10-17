package com.ktc4.pusan4.merchant.api;

import org.springframework.stereotype.Component;

/**
 * 서비스 레이어가 붙기 전까지 classification API 가 반환하는 고정 응답.
 */
@Component
public class ClassificationMockData {

    public ClassificationAnswerResponse answer() {
        return new ClassificationAnswerResponse(1, "해외SaaS", 1);
    }
}
