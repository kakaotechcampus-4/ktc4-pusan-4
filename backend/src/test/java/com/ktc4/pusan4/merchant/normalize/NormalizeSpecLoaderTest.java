package com.ktc4.pusan4.merchant.normalize;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class NormalizeSpecLoaderTest {

    private static final Path RULES = Path.of("..", "rules");

    private final NormalizeSpecLoader loader = new NormalizeSpecLoader();

    @Test
    void 브랜드_사전을_resolve_brand_단계에_넣는다() throws IOException {
        Map<String, Object> spec = loader.load(RULES);
        Object brands = loader.read(RULES.resolve("brands.yaml")).get("brands");

        assertThat(step(spec, "resolve_brand").get("brands")).isEqualTo(brands);
        assertThat((List<?>) brands).isNotEmpty();
    }

    @Test
    void PG_힌트는_pg_blocklist_가_정본이다() throws IOException {
        Map<String, Object> spec = loader.load(RULES);
        List<String> matches = NormalizeSpecLoader.pgMatches(loader.read(RULES.resolve("pg_blocklist.yaml")));

        assertThat(matches).isNotEmpty();
        assertThat(step(spec, "split_delimiters").get("pg_hints")).isEqualTo(matches);
    }

    @Test
    void pg_blocklist_가_없으면_normalize_yaml_의_힌트를_쓴다(@TempDir Path dir) throws IOException {
        write(dir.resolve("normalize.yaml"), """
            steps:
              - id: split_delimiters
                pg_hints: ["KCP"]
              - id: resolve_brand
                dict: brands.yaml
                branch: ["^[가-힣A-Z0-9]+점$"]
            """);
        write(dir.resolve("brands.yaml"), """
            brands:
              - brand_key: 가나다커피
                aliases: ["가나다커피"]
            """);

        Map<String, Object> spec = loader.load(dir);

        assertThat(step(spec, "split_delimiters").get("pg_hints")).isEqualTo(List.of("KCP"));
        assertThat(new T1Normalizer(spec).normalize("가나다커피해운대점").normKey()).isEqualTo("가나다커피");
    }

    @Test
    void pg_blocklist_가_비어_있으면_normalize_yaml_의_힌트를_쓴다(@TempDir Path dir) throws IOException {
        write(dir.resolve("normalize.yaml"), """
            steps:
              - id: split_delimiters
                pg_hints: ["KCP"]
            """);
        write(dir.resolve("pg_blocklist.yaml"), "patterns: []\n");

        Map<String, Object> spec = loader.load(dir);

        assertThat(step(spec, "split_delimiters").get("pg_hints")).isEqualTo(List.of("KCP"));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> step(Map<String, Object> spec, String id) {
        return ((List<Map<String, Object>>) spec.get("steps")).stream()
            .filter(s -> id.equals(s.get("id")))
            .findFirst()
            .orElseThrow();
    }

    private static void write(Path path, String text) throws IOException {
        Files.writeString(path, text, StandardCharsets.UTF_8);
    }
}
