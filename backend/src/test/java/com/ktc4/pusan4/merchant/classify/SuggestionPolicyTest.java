package com.ktc4.pusan4.merchant.classify;

import com.ktc4.pusan4.merchant.MerchantCategoryVocabulary;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SuggestionPolicyTest {

    private final SuggestionPolicy policy = new SuggestionPolicy(vocabulary());

    @Test
    void refused_answer_has_no_suggestions() {
        assertThat(policy.suggestions(true, List.of("음식점", "카페"))).isEmpty();
    }

    @Test
    void suggestions_keep_order_drop_invalid_and_stop_at_three() {
        List<String> raw = List.of("기타", "해외SaaS", "없는카테고리", "PG_미상", "미분류", "해외SaaS", "국내SW", "구독서비스",
            "온라인쇼핑");

        assertThat(policy.suggestions(false, raw)).containsExactly("해외SaaS", "국내SW", "구독서비스");
    }

    private static MerchantCategoryVocabulary vocabulary() {
        try {
            return MerchantCategoryVocabulary.load(Path.of("..", "rules"));
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
