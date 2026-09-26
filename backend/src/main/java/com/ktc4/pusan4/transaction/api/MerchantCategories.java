package com.ktc4.pusan4.transaction.api;

/**
 * merchantCategory 는 enum 으로 고정하지 않는다. 허용 어휘의 단일 원본이 rules/categories.yaml 이기 때문이다.
 */
public final class MerchantCategories {

    public static final String DESCRIPTION =
        "가맹점 카테고리. 허용 값은 rules/categories.yaml 의 목록 + 미분류 (api.md 2.12)";

    private MerchantCategories() {
    }
}
