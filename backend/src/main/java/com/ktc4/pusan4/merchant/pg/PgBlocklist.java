package com.ktc4.pusan4.merchant.pg;

import com.ktc4.pusan4.merchant.normalize.NormalizeSpecLoader;
import com.ktc4.pusan4.merchant.normalize.T1Result;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;

/**
 * 결제대행사(PG) 차단 판정. {@code rules/pg_blocklist.yaml} 을 그대로 실행한다. 스프링·DB 에 의존하지 않는다.
 *
 * <p>파이썬 {@code tools/pg_block.py} 의 {@code PGBlocklist.check} 와 같은 규칙이다.
 * <ol>
 *   <li>정규화 토큰({@link T1Result#lookupUnits()})을 하나씩 대소문자 무시로 검사한다</li>
 *   <li>어느 토큰도 안 걸리면 원문을 한 번 더 검사한다(정규화가 PG 이름을 지운 경우)</li>
 *   <li>걸리지 않은 토큰을 힌트와 구조 토큰({@code hint_ignore})으로 나눈다</li>
 *   <li>차단이면 {@code on_match} 의 카테고리와 seed_insert 를 붙인다</li>
 * </ol>
 * 두 구현이 같은 결과를 내는지는 {@code tools/fixtures/pg_block.yaml} 로 검사한다.
 */
public final class PgBlocklist {

    private static final int FLAGS = Pattern.UNICODE_CHARACTER_CLASS;
    /** 파이썬 {@code re.compile(p, re.I)} 에 대응한다. */
    private static final int FLAGS_CI = FLAGS | Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE;
    /** {@code hint_ignore.pattern} 이 없을 때. 아무것도 맞지 않는다. */
    private static final String NEVER = "(?!)";

    private final Map<String, Pattern> patterns = new LinkedHashMap<>();
    private final Set<String> ignoreTokens;
    private final Pattern ignorePattern;
    private final String category;
    private final boolean seedInsert;

    public PgBlocklist(Map<String, Object> spec) {
        for (Object p : listOf(spec.get("patterns"))) {
            Object match = p instanceof Map<?, ?> m ? m.get("match") : null;
            String src = match == null ? "" : String.valueOf(match);
            patterns.putIfAbsent(src, Pattern.compile(src, FLAGS_CI));
        }
        Map<String, Object> ignore = mapOf(spec.get("hint_ignore"));
        ignoreTokens = Set.copyOf(stringList(ignore.get("tokens")));
        Object ignorePat = ignore.get("pattern");
        ignorePattern = Pattern.compile(ignorePat == null ? NEVER : String.valueOf(ignorePat), FLAGS);
        Map<String, Object> onMatch = mapOf(spec.get("on_match"));
        Object cat = onMatch.get("category");
        category = cat == null ? null : String.valueOf(cat);
        seedInsert = Boolean.TRUE.equals(onMatch.get("seed_insert"));
    }

    /** {@code rulesDirectory} 는 레포의 {@code rules/} 다. */
    public static PgBlocklist load(Path rulesDirectory) throws IOException {
        return new PgBlocklist(new NormalizeSpecLoader().read(rulesDirectory.resolve("pg_blocklist.yaml")));
    }

    public PgBlockResult check(T1Result normalized) {
        String raw = normalized.raw();
        List<String> units = new ArrayList<>();
        for (String t : normalized.lookupUnits()) {
            if (!t.isBlank()) units.add(t);
        }
        if (units.isEmpty()) units.add(raw);

        List<String> pgTokens = new ArrayList<>();
        List<String> rest = new ArrayList<>();
        Set<String> matched = new TreeSet<>();
        for (String tk : units) {
            List<String> hit = hits(tk);
            if (hit.isEmpty()) {
                rest.add(tk);
            } else {
                pgTokens.add(tk);
                matched.addAll(hit);
            }
        }
        // 토큰에서 못 찾았는데 원문에 PG 가 있으면(정규화가 지점명 등으로 지운 경우) 원문 전체를 PG 로 본다.
        if (pgTokens.isEmpty()) {
            List<String> hit = hits(raw);
            if (!hit.isEmpty()) {
                matched.addAll(hit);
                pgTokens.add(raw);
                rest.clear();
            }
        }
        if (pgTokens.isEmpty()) {
            return PgBlockResult.notBlocked();
        }

        List<String> hint = new ArrayList<>();
        List<String> dropped = new ArrayList<>();
        for (String tk : rest) {
            // 파이썬 re.match 는 앞에서부터만 맞춘다 → lookingAt
            if (ignoreTokens.contains(tk) || ignorePattern.matcher(tk).lookingAt()) dropped.add(tk);
            else hint.add(tk);
        }
        return new PgBlockResult(true, List.copyOf(pgTokens), List.copyOf(matched),
                List.copyOf(hint), List.copyOf(dropped), category, seedInsert);
    }

    private List<String> hits(String text) {
        List<String> out = new ArrayList<>();
        for (Map.Entry<String, Pattern> e : patterns.entrySet()) {
            if (e.getValue().matcher(text).find()) out.add(e.getKey());
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> mapOf(Object o) {
        return o instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    }

    private static List<Object> listOf(Object o) {
        return o instanceof List<?> l ? new ArrayList<>(l) : List.of();
    }

    private static List<String> stringList(Object o) {
        List<String> out = new ArrayList<>();
        for (Object v : listOf(o)) out.add(String.valueOf(v));
        return out;
    }
}
