package com.ktc4.pusan4.merchant.classify;

import com.ktc4.pusan4.merchant.normalize.NormalizeSpecLoader;
import com.ktc4.pusan4.merchant.normalize.T1Normalizer;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 레포의 {@code rules/keyword_rules.yaml} 로 키워드 분류를 검사한다.
 * {@code test_cases} 는 파이썬 {@code tools/keyword_rules.py --selftest} 와 같은 입력·기대값이다.
 */
class KeywordRulesTest {

    // 테스트 작업 디렉터리는 Gradle 프로젝트 디렉터리(backend/)다.
    private static final Path RULES = Path.of("..", "rules");

    @TestFactory
    @SuppressWarnings("unchecked")
    Stream<DynamicTest> keyword_rules_yaml_test_cases() throws IOException {
        T1Normalizer normalizer = new T1Normalizer(new NormalizeSpecLoader().load(RULES));
        KeywordRules rules = KeywordRules.load(RULES);
        List<Map<String, Object>> cases = (List<Map<String, Object>>) rules.spec().get("test_cases");
        assertThat(cases).as("keyword_rules.yaml test_cases").isNotEmpty();

        return cases.stream().map(c -> {
            String in = String.valueOf(c.get("in"));
            String want = String.valueOf(c.get("out"));
            // 파이썬 selftest 와 같이 원문과 정규화 문자열 양쪽에 건다.
            return DynamicTest.dynamicTest(in, () -> assertThat(
                    rules.classify(in, normalizer.normalize(in).stringNorm()).map(KeywordMatch::category))
                    .hasValue(want));
        });
    }

    @Test
    void match_나_category_가_없는_룰은_로드할_때_실패한다() {
        assertThatThrownBy(() -> new KeywordRules(Map.of("rules", List.of(
                Map.of("priority", 700, "category", "온라인쇼핑")))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("match");
        assertThatThrownBy(() -> new KeywordRules(Map.of("rules", List.of(
                Map.of("priority", 700, "match", "쿠팡")))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("category");
    }

    @Test
    void 더_높은_priority_가_이긴다() {
        KeywordRules rules = new KeywordRules(Map.of("rules", List.of(
                Map.of("priority", 730, "match", "쿠팡", "category", "온라인쇼핑"),
                Map.of("priority", 830, "match", "쿠팡이츠", "category", "음식배달"))));

        assertThat(rules.classify("쿠팡이츠").map(KeywordMatch::category)).hasValue("음식배달");
    }

    @Test
    void priority_가_같으면_긴_패턴이_이기고_그다음은_파일_순서다() {
        KeywordRules rules = new KeywordRules(Map.of("rules", List.of(
                Map.of("priority", 700, "match", "AB", "category", "첫째"),
                Map.of("priority", 700, "match", "ABC", "category", "긴패턴"),
                Map.of("priority", 700, "match", "BC", "category", "셋째"))));

        assertThat(rules.classify("XABCX").map(KeywordMatch::category)).hasValue("긴패턴");
        assertThat(rules.classify("XABX", "XBCX").map(KeywordMatch::category)).hasValue("첫째");
    }

    @Test
    void 대소문자를_무시한다() {
        KeywordRules rules = new KeywordRules(Map.of("rules", List.of(
                Map.of("priority", 800, "match", "STEAM", "category", "게임"))));

        assertThat(rules.classify("Steam (Korea)").map(KeywordMatch::category)).hasValue("게임");
    }

    @Test
    void 어느_표현형에서든_걸리면_후보가_된다() throws IOException {
        KeywordRules rules = KeywordRules.load(RULES);

        // '_' 가 구분자라 정규화 문자열에서는 안 걸리고 원문에서만 걸린다.
        assertThat(rules.classify("지하철_모바일 26 건", "").map(KeywordMatch::category)).hasValue("여비교통");
    }

    @Test
    void uncertain_룰은_힌트로만_돌려준다() throws IOException {
        KeywordMatch match = KeywordRules.load(RULES).classify("RESEND.COM").orElseThrow();

        assertThat(match.uncertain()).isTrue();
        assertThat(match.hint()).isNotBlank();
    }

    @Test
    void 아무_룰에도_안_걸리면_비어_있다() throws IOException {
        assertThat(KeywordRules.load(RULES).classify("성진이네", null, "")).isEmpty();
    }
}
