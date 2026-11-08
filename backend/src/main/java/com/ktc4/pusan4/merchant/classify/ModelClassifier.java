package com.ktc4.pusan4.merchant.classify;

import java.util.List;
import java.util.Map;

/**
 * 규칙으로 못 잡은 가맹점을 분류 모델에 묻는다 (B10). 업로드를 실패시키지 않도록 예외를 던지지 않는다.
 */
public interface ModelClassifier {

    /**
     * @param merchants merchantNorm 이 겹치지 않는 가맹점들
     * @return merchantNorm → 답. 실패·시간 초과로 답이 없는 가맹점은 빠진다. 전체가 실패하면 빈 맵이다
     */
    Map<String, ModelDecision> classify(List<Merchant> merchants);

    record Merchant(String merchantNorm, String merchantRaw) {
    }
}
