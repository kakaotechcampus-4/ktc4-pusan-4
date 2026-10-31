package com.ktc4.pusan4.merchant.classify;

import com.ktc4.pusan4.merchant.MerchantCategoryVocabulary;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * 모델 답에서 분류 확인 화면에 보일 후보를 고른다 (docs/category_decision_eval.md). DB 를 보지 않는다.
 *
 * <p>모델 답으로 카테고리를 확정하지 않는다. 분류 확인은 항상 사용자가 답하고, 모델 답은 후보로만 쓴다(PR #196 리뷰).
 * 쓸 수 있는 카테고리는 허용 어휘({@code categories.yaml}) 에서 {@code 기타}·{@code PG_미상} 을 뺀 것이다.
 * {@code 미분류} 는 허용 어휘에 없어 따로 빼지 않아도 걸러진다.
 */
@Component
public class SuggestionPolicy {

    private static final Set<String> NOT_A_DECISION = Set.of("기타", "PG_미상");
    private static final int MAX_SUGGESTIONS = 3;

    private final MerchantCategoryVocabulary vocabulary;

    public SuggestionPolicy(MerchantCategoryVocabulary vocabulary) {
        this.vocabulary = vocabulary;
    }

    /** 분류 확인 화면의 후보. 거절했으면 없다. */
    public List<String> suggestions(boolean refused, List<String> suggestions) {
        if (refused) {
            return List.of();
        }
        return suggestions.stream().filter(this::usable).distinct().limit(MAX_SUGGESTIONS).toList();
    }

    private boolean usable(String category) {
        return category != null && vocabulary.contains(category) && !NOT_A_DECISION.contains(category);
    }
}
