package com.ktc4.pusan4.merchant.pg;

import com.ktc4.pusan4.merchant.normalize.NormalizeSpecLoader;
import com.ktc4.pusan4.merchant.normalize.T1Normalizer;
import com.ktc4.pusan4.merchant.normalize.T1Result;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 레포의 {@code rules/pg_blocklist.yaml} 로 PG 차단을 검사한다.
 * 파이썬 {@code tools/pg_block.py --fixture} 가 같은 fixture, 같은 기대값을 쓴다.
 */
class PgBlocklistRulesTest {

    // 테스트 작업 디렉터리는 Gradle 프로젝트 디렉터리(backend/)다.
    private static final Path RULES = Path.of("..", "rules");
    private static final Path FIXTURE = Path.of("..", "tools", "fixtures", "pg_block.yaml");

    private final NormalizeSpecLoader loader = new NormalizeSpecLoader();

    @TestFactory
    @SuppressWarnings("unchecked")
    Stream<DynamicTest> pg_block_fixture() throws IOException {
        T1Normalizer normalizer = new T1Normalizer(loader.load(RULES));
        PgBlocklist pg = PgBlocklist.load(RULES);
        List<Map<String, Object>> cases = (List<Map<String, Object>>) loader.read(FIXTURE).get("cases");
        assertThat(cases).as("pg_block cases").isNotEmpty();

        return cases.stream().map(c -> {
            String in = String.valueOf(c.get("in"));
            return DynamicTest.dynamicTest(in, () -> {
                PgBlockResult r = pg.check(normalizer.normalize(in, ""));
                assertThat(r.blocked()).as("blocked").isEqualTo(c.get("blocked"));
                assertThat(r.pgTokens()).as("pg_tokens").isEqualTo(c.get("pg_tokens"));
                assertThat(r.hintTokens()).as("hint").isEqualTo(c.get("hint"));
                assertThat(r.droppedTokens()).as("dropped").isEqualTo(c.get("dropped"));
            });
        });
    }

    @Test
    void 차단되면_on_match_의_카테고리와_seed_insert_를_붙인다() throws IOException {
        T1Normalizer normalizer = new T1Normalizer(loader.load(RULES));
        PgBlockResult r = PgBlocklist.load(RULES).check(normalizer.normalize("토스페이_가나다샵", ""));

        assertThat(r.category()).isEqualTo("PG_미상");
        assertThat(r.seedInsert()).isFalse();
        assertThat(r.matchedPatterns()).hasSize(1).allMatch(p -> p.contains("토스페이"));
    }

    @Test
    void 차단되지_않으면_카테고리가_없다() throws IOException {
        T1Normalizer normalizer = new T1Normalizer(loader.load(RULES));
        T1Result n = normalizer.normalize("가나다샵", "");

        assertThat(PgBlocklist.load(RULES).check(n)).isEqualTo(PgBlockResult.notBlocked());
    }

    @Test
    void hint_ignore_가_없으면_남은_토큰은_전부_힌트다() throws IOException {
        T1Normalizer normalizer = new T1Normalizer(loader.load(RULES));
        PgBlocklist pg = new PgBlocklist(Map.of(
            "patterns", List.of(Map.of("match", "토스페이")),
            "on_match", Map.of("category", "PG_미상", "seed_insert", false)));

        PgBlockResult r = pg.check(normalizer.normalize("토스페이_대표", ""));

        assertThat(r.hintTokens()).containsExactly("대표");
        assertThat(r.droppedTokens()).isEmpty();
    }
}
