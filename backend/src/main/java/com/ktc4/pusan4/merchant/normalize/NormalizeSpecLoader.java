package com.ktc4.pusan4.merchant.normalize;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * {@code rules/normalize.yaml} 을 읽어 {@link T1Normalizer} 에 넘길 스펙을 만든다.
 *
 * <p>파이썬 {@code tools/normalize.py} 의 {@code load()} 와 같은 일을 한다. 규칙 파일은 하나씩만 두고
 * 다른 파일에 있는 목록을 로더가 단계에 넣는다. 사본을 두면 한쪽만 고쳐져 갈라진다.
 * <ul>
 *   <li>{@code split_delimiters.pg_hints} — {@code rules/pg_blocklist.yaml} 의 {@code match} 목록으로 바꾼다.
 *       파일이 없거나 목록이 비면 {@code normalize.yaml} 에 적힌 값을 그대로 쓴다.</li>
 *   <li>{@code resolve_brand.brands} — 그 단계의 {@code dict}(기본 {@code brands.yaml}) 를 읽어 넣는다.</li>
 * </ul>
 */
public final class NormalizeSpecLoader {

    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() { };

    private final ObjectMapper mapper = new ObjectMapper(new YAMLFactory());

    /** {@code rulesDirectory} 는 레포의 {@code rules/} 다. */
    public Map<String, Object> load(Path rulesDirectory) throws IOException {
        Path normalizeYaml = rulesDirectory.resolve("normalize.yaml");
        Map<String, Object> spec = read(normalizeYaml);

        Path pgYaml = rulesDirectory.resolve("pg_blocklist.yaml");
        if (Files.exists(pgYaml)) {
            injectPgHints(spec, pgMatches(read(pgYaml)));
        }
        for (Map<String, Object> step : steps(spec, "resolve_brand")) {
            Path dict = normalizeYaml.getParent().resolve(String.valueOf(step.getOrDefault("dict", "brands.yaml")));
            step.put("brands", listOf(read(dict).get("brands")));
        }
        return spec;
    }

    /** YAML 파일 하나를 {@code Map} 으로 읽는다. 브랜드 fixture 처럼 스펙 밖의 파일에도 쓴다. */
    public Map<String, Object> read(Path path) throws IOException {
        Map<String, Object> doc = mapper.readValue(path.toFile(), MAP);
        return doc == null ? new LinkedHashMap<>() : doc;
    }

    /** resolve_brand 단계의 브랜드 목록을 바꿔 끼운다. 파이썬 {@code inject_brands(spec, brands)} 와 같다. */
    public static void injectBrands(Map<String, Object> spec, List<Object> brands) {
        for (Map<String, Object> step : steps(spec, "resolve_brand")) {
            step.put("brands", brands);
        }
    }

    static void injectPgHints(Map<String, Object> spec, List<String> patterns) {
        if (patterns.isEmpty()) {
            return;
        }
        for (Map<String, Object> step : steps(spec, "split_delimiters")) {
            step.put("pg_hints", patterns);
        }
    }

    @SuppressWarnings("unchecked")
    static List<String> pgMatches(Map<String, Object> pgDoc) {
        List<String> out = new ArrayList<>();
        for (Object p : listOf(pgDoc.get("patterns"))) {
            if (p instanceof Map<?, ?> m) {
                Object match = ((Map<String, Object>) m).get("match");
                if (match != null && !String.valueOf(match).isEmpty()) {
                    out.add(String.valueOf(match));
                }
            }
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> steps(Map<String, Object> spec, String id) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object step : listOf(spec.get("steps"))) {
            if (step instanceof Map<?, ?> m && id.equals(String.valueOf(m.get("id")))) {
                out.add((Map<String, Object>) m);
            }
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static List<Object> listOf(Object o) {
        return o instanceof List<?> l ? (List<Object>) l : List.of();
    }
}
