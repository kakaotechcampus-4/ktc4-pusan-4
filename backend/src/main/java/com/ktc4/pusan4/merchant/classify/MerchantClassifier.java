package com.ktc4.pusan4.merchant.classify;

import java.util.List;
import java.util.UUID;

/**
 * 가맹점 분류기. 업로드 한 건을 통째로 받아 한 번에 분류한다.
 *
 * <p>목록 단위인 이유는 둘이다. 사전 조회를 거래마다 하지 않고 한 번의 {@code IN} 쿼리로 묶고,
 * B10 에서 사전·키워드로 못 잡은 가맹점만 모아 분류 AI 를 한 번 호출할 자리를 남긴다.
 */
public interface MerchantClassifier {

    /**
     * @param userId 개인 사전을 볼 사용자
     * @param inputs 분류할 거래들
     * @return {@code inputs} 와 같은 순서, 같은 길이의 결과. B4 는 인덱스로 거래와 짝을 맞춘다
     */
    List<ClassificationResult> classifyAll(UUID userId, List<ClassificationInput> inputs);
}
