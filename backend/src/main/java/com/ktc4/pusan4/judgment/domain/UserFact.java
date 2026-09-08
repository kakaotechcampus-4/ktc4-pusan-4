package com.ktc4.pusan4.judgment.domain;

import java.util.Map;

public record UserFact(String scopeKey, String factType, Map<String, Object> value) {
    public UserFact {
        value = value == null ? Map.of() : Map.copyOf(value);
    }

    public String selectedValue() {
        Object selected = value.containsKey("value") ? value.get("value") : value.get("answer");
        return selected instanceof String string ? string : null;
    }
}
