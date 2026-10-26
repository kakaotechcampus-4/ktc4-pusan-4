package com.ktc4.pusan4.merchant.classify;

import com.ktc4.pusan4.merchant.normalize.NormalizeSpecLoader;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.regex.Pattern;

/**
 * 키워드 분류. {@code rules/keyword_rules.yaml} 을 그대로 실행한다. 스프링·DB 에 의존하지 않는다.
 *
 * <p>파이썬 {@code tools/keyword_rules.py} 의 {@code KeywordRules.classify} 와 같은 규칙이다.
 * <ul>
 *   <li>패턴은 대소문자 무시, 부분 일치({@code re.search})다</li>
 *   <li>여러 표현형(원문·정규화 문자열)에 모두 걸어 보고 걸린 룰을 합친다.
 *       원문만 보면 '쿠팡 이츠' 가 '쿠팡'(온라인쇼핑)으로, 정규화만 보면 '지하철_모바일' 이 미분류로 빠진다</li>
 *   <li>승자는 priority 내림차순 → 패턴 길이 내림차순 → 파일 순서다</li>
 * </ul>
 * 카테고리만 정한다. verdict 는 룰카드가 정한다.
 */
public final class KeywordRules {

    /** 분류하지 않고 힌트만 남기는 룰의 카테고리 값. */
    public static final String UNCERTAIN = "uncertain";

    /** 파이썬 {@code re.compile(p, re.I)} 에 대응한다. {@code PgBlocklist} 와 같은 플래그다. */
    private static final int FLAGS = Pattern.UNICODE_CHARACTER_CLASS | Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE;

    private static final Comparator<Rule> WINNER_FIRST = Comparator
            .comparingInt(Rule::priority).reversed()
            .thenComparing(Comparator.comparingInt(Rule::length).reversed())
            .thenComparingInt(Rule::index);

    private final Map<String, Object> spec;
    private final List<Rule> rules;

    private record Rule(int index, String source, Pattern pattern, String category, int priority, String hint) {
        int length() {
            return source.codePointCount(0, source.length());
        }
    }

    public KeywordRules(Map<String, Object> spec) {
        this.spec = spec == null ? Map.of() : spec;
        List<Rule> loaded = new ArrayList<>();
        int index = 0;
        for (Map<String, Object> r : listOfMaps(this.spec.get("rules"))) {
            // match 가 비면 빈 패턴이 모든 문자열에 걸려 그 priority 아래 룰을 전부 가로챈다. 기동 때 막는다.
            String source = required(r, "match", index);
            String category = required(r, "category", index);
            loaded.add(new Rule(
                    index++,
                    source,
                    Pattern.compile(source, FLAGS),
                    category,
                    Integer.parseInt(String.valueOf(r.getOrDefault("priority", 0))),
                    r.get("hint") == null ? "" : String.valueOf(r.get("hint"))));
        }
        this.rules = List.copyOf(loaded);
    }

    /** {@code rulesDirectory} 는 레포의 {@code rules/} 다. */
    public static KeywordRules load(Path rulesDirectory) throws IOException {
        return new KeywordRules(new NormalizeSpecLoader().read(rulesDirectory.resolve("keyword_rules.yaml")));
    }

    public Map<String, Object> spec() {
        return spec;
    }

    /**
     * 여러 표현형에 모두 걸어 보고 가장 강한 룰을 고른다. 빈 문자열·{@code null} 은 건너뛴다.
     *
     * @return 걸린 룰이 없으면 비어 있다. uncertain 룰이 이겨도 값이 있다({@link KeywordMatch#uncertain()})
     */
    public Optional<KeywordMatch> classify(String... texts) {
        Map<Integer, Rule> hits = new TreeMap<>();
        for (String text : texts) {
            if (text == null || text.isEmpty()) {
                continue;
            }
            for (Rule rule : rules) {
                if (!hits.containsKey(rule.index()) && rule.pattern().matcher(text).find()) {
                    hits.put(rule.index(), rule);
                }
            }
        }
        return hits.values().stream()
                .min(WINNER_FIRST)
                .map(win -> new KeywordMatch(win.category(), win.source(), win.hint()));
    }

    private static String required(Map<String, Object> rule, String key, int index) {
        Object value = rule.get(key);
        if (value == null || String.valueOf(value).isBlank()) {
            throw new IllegalArgumentException("keyword_rules.yaml rules[" + index + "]: " + key + " 가 없다: " + rule);
        }
        return String.valueOf(value);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> listOfMaps(Object value) {
        return value instanceof List<?> list ? (List<Map<String, Object>>) list : List.of();
    }
}
