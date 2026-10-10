package com.ktc4.pusan4.merchant.normalize;

import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 레포의 규칙 파일로 정규화기를 검사한다. 파이썬 {@code tools/normalize.py} 가 같은 파일, 같은 기대값을 쓴다.
 * <ul>
 *   <li>{@code rules/normalize.yaml} 의 {@code test_cases} — 파이썬 {@code --selftest}</li>
 *   <li>{@code tools/fixtures/brand_layer1.yaml} — 파이썬 {@code --fixture}</li>
 * </ul>
 * 규칙 파일이 바뀌면 backend CI 가 이 테스트를 다시 돌린다. 두 구현이 갈라지면 여기서 드러난다.
 */
class T1NormalizerRulesTest {

    // 테스트 작업 디렉터리는 Gradle 프로젝트 디렉터리(backend/)다.
    private static final Path RULES = Path.of("..", "rules");
    private static final Path BRAND_FIXTURE = Path.of("..", "tools", "fixtures", "brand_layer1.yaml");

    private final NormalizeSpecLoader loader = new NormalizeSpecLoader();

    @TestFactory
    @SuppressWarnings("unchecked")
    Stream<DynamicTest> normalize_yaml_test_cases() throws IOException {
        T1Normalizer normalizer = new T1Normalizer(loader.load(RULES));
        List<Map<String, Object>> cases = (List<Map<String, Object>>) normalizer.spec().get("test_cases");
        assertThat(cases).as("normalize.yaml test_cases").isNotEmpty();

        return cases.stream().map(c -> {
            String in = String.valueOf(c.get("in"));
            String want = String.valueOf(c.get("out"));
            return DynamicTest.dynamicTest(in, () -> assertThat(normalizer.stringKey(in)).isEqualTo(want));
        });
    }

    @TestFactory
    @SuppressWarnings("unchecked")
    Stream<DynamicTest> brand_layer1_fixture() throws IOException {
        Map<String, Object> spec = loader.load(RULES);
        Map<String, Object> fixture = loader.read(BRAND_FIXTURE);
        NormalizeSpecLoader.injectBrands(spec, (List<Object>) fixture.get("brands"));
        T1Normalizer normalizer = new T1Normalizer(spec);
        List<Map<String, Object>> cases = (List<Map<String, Object>>) fixture.get("cases");
        assertThat(cases).as("brand_layer1 cases").isNotEmpty();

        return cases.stream().map(c -> {
            String in = String.valueOf(c.get("in"));
            Object biz = c.get("biz");
            return DynamicTest.dynamicTest(in, () -> {
                T1Result r = normalizer.normalize(in, biz == null ? "" : String.valueOf(biz));
                for (Map.Entry<String, Object> e : c.entrySet()) {
                    if ("in".equals(e.getKey()) || "biz".equals(e.getKey())) {
                        continue;
                    }
                    assertThat(String.valueOf(field(r, e.getKey())))
                        .as(e.getKey())
                        .isEqualTo(String.valueOf(e.getValue()));
                }
            });
        });
    }

    /** fixture 필드명은 파이썬 Result 이름(snake_case)이다. */
    private static Object field(T1Result r, String name) {
        return switch (name) {
            case "norm_key" -> r.normKey();
            case "track" -> r.track();
            case "string_norm" -> r.stringNorm();
            case "is_truncated" -> r.truncated();
            case "biz_no" -> r.bizNo();
            case "brand_key" -> r.brandKey();
            case "brand_restored" -> r.brandRestored();
            case "branch" -> r.branch();
            case "branch_raw" -> r.branchRaw();
            default -> throw new IllegalArgumentException("fixture: 모르는 필드 " + name);
        };
    }
}
