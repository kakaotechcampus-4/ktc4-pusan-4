package com.ktc4.pusan4.judgment.api;

import org.springframework.stereotype.Component;

import java.util.List;

import static com.ktc4.pusan4.shared.api.MockFixtures.FACT_ID;

/**
 * 서비스 레이어가 붙기 전까지 일괄 응답 API 가 반환하는 고정 응답.
 */
@Component
public class JudgmentMockData {

    public BulkAnswerResponse bulkAnswer() {
        return new BulkAnswerResponse(1, 0, /* excludedCount */ 0, List.of(FACT_ID), 1, new Unresolved(0, 0L));
    }
}
