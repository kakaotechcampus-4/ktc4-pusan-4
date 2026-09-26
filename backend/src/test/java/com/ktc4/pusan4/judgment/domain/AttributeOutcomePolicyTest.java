package com.ktc4.pusan4.judgment.domain;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;



public class AttributeOutcomePolicyTest {

    @Test
    void returns_true_when_unregistered_attribute_name_is_given() {
        // given
        String attributeName = "선급비용";

        // when
        boolean result = AttributeOutcomePolicy.changesOutcome(attributeName);

        // then
        assertThat(result).isTrue();
    }


    @Test
    void returns_false_when_registered_attribute_name_is_given() {
        // given
        String attributeName = "가산세율";

        // when
        boolean result = AttributeOutcomePolicy.changesOutcome(attributeName);

        // then
        assertThat(result).isFalse();
    }
}