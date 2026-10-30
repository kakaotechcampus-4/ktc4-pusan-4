package com.ktc4.pusan4.merchant;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;

import java.io.IOException;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;

/**
 * 가맹점 카테고리 허용 어휘 (api.md 2.12). 단일 원본은 {@code rules/categories.yaml} 이다.
 * {@code 미분류} 는 이 목록에 없는 별도 센티넬이다.
 */
public final class MerchantCategoryVocabulary {

    private final Set<String> categories;

    private MerchantCategoryVocabulary(Set<String> categories) {
        this.categories = Set.copyOf(categories);
    }

    public static MerchantCategoryVocabulary load(Path rulesDirectory) throws IOException {
        JsonNode names = new ObjectMapper(new YAMLFactory())
            .readTree(rulesDirectory.resolve("categories.yaml").toFile()).path("categories");
        if (!names.isArray()) {
            throw new IllegalStateException("categories.yaml: categories must be a list");
        }
        Set<String> categories = new HashSet<>();
        names.forEach(name -> categories.add(name.asText()));
        return new MerchantCategoryVocabulary(categories);
    }

    public boolean contains(String category) {
        return categories.contains(category);
    }
}
