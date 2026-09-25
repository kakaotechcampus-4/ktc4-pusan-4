package com.ktc4.pusan4.shared.api;

import java.util.List;
import java.util.UUID;

/**
 * 기능별 *MockData 가 함께 쓰는 id 와 페이지 래퍼.
 *
 * <p>POST 가 돌려준 id 로 이어서 GET 을 불러도 같은 데이터를 가리키도록 id 를 고정한다.
 * 모든 MockData 가 서비스로 바뀌면 이 클래스도 지운다.
 */
public final class MockFixtures {

    public static final UUID USER_ID = UUID.fromString("0199c8f2-0000-7000-8000-000000000001");
    public static final UUID CONTEXT_ID = UUID.fromString("0199d3a1-0000-7000-8000-000000000001");
    public static final UUID BATCH_ID = UUID.fromString("0199aa11-0000-7000-8000-000000000001");
    public static final UUID RUN_ID = UUID.fromString("0199e5b2-0000-7000-8000-000000000001");
    /** 스타벅스 거래. 분류 완료, 용도 질문 대기 중 */
    public static final UUID TRANSACTION_ID = UUID.fromString("0199f1a0-0000-7000-8000-000000001005");
    /** ELEVENLABS IO 거래. 미분류라 ClassificationReview 대기 중 */
    public static final UUID UNCLASSIFIED_TRANSACTION_ID =
        UUID.fromString("0199f1a0-0000-7000-8000-000000001023");
    public static final UUID JUDGMENT_ID = UUID.fromString("0199f1c3-0000-7000-8000-000000001005");
    public static final UUID OVERRIDE_JUDGMENT_ID = UUID.fromString("0199f1c3-0000-7000-8000-000000002005");
    public static final UUID OVERRIDE_ID = UUID.fromString("0199f2d4-0000-7000-8000-000000000001");
    public static final UUID REVIEW_ID = UUID.fromString("0199c1a1-0000-7000-8000-000000000001");
    public static final UUID QUESTION_ID = UUID.fromString("0199a1b2-0000-7000-8000-000000000001");
    public static final UUID FACT_ID = UUID.fromString("0199b3c4-0000-7000-8000-000000000001");

    private MockFixtures() {
    }

    /** 모든 항목이 첫 페이지에 들어가는 페이지 정보. */
    public static PageResponse.PageMeta singlePage(int count) {
        return new PageResponse.PageMeta(0, 20, count, count == 0 ? 0 : 1, false);
    }

    public static <T> PageResponse<T> page(List<T> items) {
        return new PageResponse<>(items, singlePage(items.size()));
    }
}
