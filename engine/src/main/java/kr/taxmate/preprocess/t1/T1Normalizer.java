package kr.taxmate.preprocess.t1;

import java.nio.charset.Charset;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * {@code rules/normalize.yaml} 을 실행하는 T1 정규화 엔진.
 *
 * <p>규칙은 이 클래스에 없다. YAML 이 단계 목록을 정하고 여기서는 그 이름에 해당하는
 * 동작만 제공한다. 규칙을 고치려면 YAML 을 고친다.
 *
 * <p>파이썬 구현({@code tools/normalize.py})과 문자 단위로 같은 결과를 내는 것이 목표다.
 * 두 구현이 갈라지면 사전에 쌓인 키가 조용히 무효가 되므로, 아래 세 가지는
 * 편의로 바꾸지 않는다.
 * <ul>
 *   <li>정규식은 {@link Pattern#UNICODE_CHARACTER_CLASS} 로 컴파일한다.
 *       파이썬 {@code \s}·{@code \d}·{@code \w} 는 기본이 유니코드다.</li>
 *   <li>{@code fullwidth_to_halfwidth} 는 전각 변환이 아니라 NFKC 전체다.
 *       {@code ㈜} 가 {@code (주)} 로 분해되는 것까지 같아야 한다.</li>
 *   <li>절단 판정 바이트 수는 EUC-KR 로 잰다. 인코딩 불가 문자는 {@code ?} 한 바이트가 된다.</li>
 * </ul>
 *
 * <p><b>스레드 안전.</b> 이 클래스는 불변이다. 스펙에서 읽은 필드는 생성자에서만 채우고,
 * 정규식은 생성자의 {@link #precompile()} 이 전부 컴파일해 둔다. 호출마다 바뀌는 상태는
 * {@link Ctx} 와 {@link Matcher} 뿐이고 둘 다 호출 안에서 새로 만든다.
 * 따라서 인스턴스 하나를 여러 스레드가 공유해도 된다(예: 스프링 싱글톤 빈).
 */
public final class T1Normalizer {

    private static final int FLAGS = Pattern.UNICODE_CHARACTER_CLASS;
    private static final Pattern SPACES = Pattern.compile("\\s+", FLAGS);
    private static final Pattern BARE = Pattern.compile("[\\s.\\-*#/&,'\"()\\[\\]|]", FLAGS);
    private static final Pattern ASCII_LETTER = Pattern.compile("[A-Za-z]");
    private static final Pattern LETTER = Pattern.compile("[A-Za-z가-힣]");
    /** {@code strip_special} 단계의 {@code chars} 가 비었을 때 쓰는 기본 문자 클래스. */
    private static final String STRIP_SPECIAL_DEFAULT = "[.*#/&,'\"()\\[\\]_~\\\\]";

    private final Map<String, Object> spec;
    private final List<Map<String, Object>> steps;
    private final List<String> exceptions = new ArrayList<>();
    private final List<String> exceptionsBare = new ArrayList<>();
    private final Map<String, Object> truncation;
    private final Map<String, Object> overseas;
    /** 대소문자 구분 패턴 캐시. {@link #precompile()} 이 채우고 이후에는 읽기만 한다. */
    private final Map<String, Pattern> cache = new ConcurrentHashMap<>();
    /** 대소문자 무시 패턴 캐시. 같은 정규식이라도 플래그가 달라 별도 맵으로 둔다. */
    private final Map<String, Pattern> cacheCi = new ConcurrentHashMap<>();

    @SuppressWarnings("unchecked")
    public T1Normalizer(Map<String, Object> spec) {
        this.spec = spec == null ? Map.of() : spec;
        this.steps = (List<Map<String, Object>>) this.spec.getOrDefault("steps", List.of());
        for (Object e : (List<Object>) this.spec.getOrDefault("exceptions", List.of())) {
            exceptions.add(String.valueOf(e));
            exceptionsBare.add(bare(String.valueOf(e)));
        }
        Map<String, Object> detect = (Map<String, Object>) this.spec.getOrDefault("detect", Map.of());
        this.truncation = (Map<String, Object>) detect.getOrDefault("truncation", Map.of());
        this.overseas = (Map<String, Object>) detect.getOrDefault("overseas", Map.of());
        precompile();
    }

    /**
     * YAML 에 적힌 정규식을 로딩 시점에 전부 컴파일한다.
     *
     * <p>두 가지를 노린다.
     * <ul>
     *   <li>깨진 정규식이 파이프라인 도중이 아니라 생성자에서 {@link java.util.regex.PatternSyntaxException}
     *       으로 드러난다. 규칙 파일을 고친 사람이 바로 알 수 있다.</li>
     *   <li>런타임에는 캐시가 읽기 전용이 되어 스레드 간 경쟁이 생기지 않는다.</li>
     * </ul>
     *
     * <p>정규식을 담는 키는 {@code patterns}·{@code preserve}·{@code pg_hints}·{@code chars}·{@code branch} 다섯이다.
     * 새 단계가 다른 키로 정규식을 받게 되면 여기에도 추가한다. 빠뜨려도 동작은 한다 —
     * 캐시가 {@link ConcurrentHashMap} 이라 지연 컴파일로 안전하게 되돌아갈 뿐이다.
     */
    private void precompile() {
        for (Map<String, Object> step : steps) {
            for (String p : stringList(step.get("patterns"))) pattern(p);   // strip_corp, strip_branch
            for (String p : stringList(step.get("preserve"))) pattern(p);   // split_delimiters
            for (String h : stringList(step.get("pg_hints"))) patternCi(h); // split_delimiters
            for (String b : stringList(step.get("branch"))) pattern(b);     // resolve_brand
            Object chars = step.get("chars");                              // strip_special
            pattern(chars == null ? STRIP_SPECIAL_DEFAULT : String.valueOf(chars));
        }
    }

    public Map<String, Object> spec() { return spec; }

    // ---------------------------------------------------------------- 공개 API

    /** norm_key 는 항상 문자열이다(#22 A안). 사업자번호는 bizNo 로만 남긴다. */
    public T1Result normalize(String raw, String bizNo) {
        Ctx ctx = new Ctx(bare(raw));
        String s = runPipeline(raw, ctx);
        String biz = bizNo == null ? "" : bizNo.trim();
        boolean isOverseas = isOverseas(raw, biz);
        String track = isOverseas ? "overseas" : "string";

        return new T1Result(raw, s, track, s, isOverseas ? s : "",
                List.copyOf(ctx.tokens), ctx.isTruncated, isOverseas, ctx.encBytes,
                ctx.branchSkipped, List.copyOf(ctx.branchBlocked), List.copyOf(ctx.protectedTokens),
                ctx.pgHint, ctx.condSplit, ctx.condKept, ctx.collapsed,
                biz, ctx.brandKey, ctx.brandRestored, ctx.branch, ctx.branchRaw);
    }

    public T1Result normalize(String raw) { return normalize(raw, ""); }

    /** 문자열 트랙 결과만. 사전 적재 검증과 회귀 테스트가 쓴다. */
    public String stringKey(String raw) { return runPipeline(raw, new Ctx(bare(raw))); }

    // ---------------------------------------------------------------- 파이프라인

    private String runPipeline(String raw, Ctx ctx) {
        String s = raw == null ? "" : raw;
        for (Map<String, Object> step : steps) {
            String id = String.valueOf(step.get("id"));
            ctx.history.add(s);                       // 각 단계 '실행 직전' 값
            s = apply(id, s, ctx, step);
        }
        return s.strip();
    }

    private String apply(String id, String s, Ctx ctx, Map<String, Object> step) {
        switch (id) {
            case "trim_normalize_space":   return SPACES.matcher(s).replaceAll(" ").strip();
            case "fullwidth_to_halfwidth": return Normalizer.normalize(s, Normalizer.Form.NFKC);
            case "detect_truncation":      return detectTruncation(s, ctx);
            case "strip_corp":             return stripCorp(s, step);
            case "split_delimiters":       return splitDelimiters(s, ctx, step);
            case "strip_special":          return stripSpecial(s, step);
            case "upper_ascii":            return upperAscii(s);
            case "resolve_brand":          return resolveBrand(s, ctx, step);
            case "strip_branch":           return stripBranch(s, ctx, step);
            case "protect_exceptions":     return protectExceptions(s, ctx);
            case "drop_space":             return s.replace(" ", "");
            default:
                throw new IllegalArgumentException("normalize.yaml: 알 수 없는 step id '" + id + "'");
        }
    }

    private String detectTruncation(String s, Ctx ctx) {
        int maxBytes = intOf(truncation.get("max_bytes"), 20);
        ctx.encBytes = encodedLength(s);
        // '이상' 이 아니라 '정확히 한계값' 이다. 카드사가 20에서 자르므로 그보다 긴 문자열은
        // 애초에 오지 않는다. >= 로 두면 20을 넘는 정상 입력까지 절단으로 오판한다.
        ctx.isTruncated = ctx.encBytes == maxBytes;
        // 닫히지 않은 괄호는 바이트와 무관하게 절단 확정이다(T5 1층 8행).
        if (Boolean.TRUE.equals(truncation.get("unclosed_bracket")) && unclosedBracket(s)) {
            ctx.isTruncated = true;
        }
        // 19바이트는 의심만 남긴다. resolve_brand 가 사전과 맞을 때만 확정한다.
        Object suspect = truncation.get("suspect_bytes");
        ctx.truncationSuspect = suspect instanceof Number n && !ctx.isTruncated && ctx.encBytes == n.intValue();
        return s;
    }

    private static boolean unclosedBracket(String s) {
        return countChar(s, '(') > countChar(s, ')') || countChar(s, '[') > countChar(s, ']');
    }

    private static int countChar(String s, char c) {
        int n = 0;
        for (int i = 0; i < s.length(); i++) if (s.charAt(i) == c) n++;
        return n;
    }

    private int encodedLength(String s) {
        String enc = String.valueOf(truncation.getOrDefault("encoding", "euc-kr"));
        try {
            return s.getBytes(Charset.forName(enc)).length;
        } catch (IllegalArgumentException e) {   // UnsupportedCharset·IllegalCharsetName 둘 다 여기
            return s.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
        }
    }

    private String stripCorp(String s, Map<String, Object> step) {
        for (String pat : stringList(step.get("patterns"))) {
            s = pattern(pat).matcher(s).replaceAll("");
        }
        return SPACES.matcher(s).replaceAll(" ").strip();
    }

    private String splitDelimiters(String s, Ctx ctx, Map<String, Object> step) {
        List<String> always = stringList(step.get("always"));
        if (always.isEmpty()) always = List.of("*");
        List<String> cond = stringList(step.get("conditional"));
        int minTokens = intOf(step.get("conditional_min_tokens"), 3);
        String join = step.get("join") == null ? "|" : String.valueOf(step.get("join"));

        for (String pat : stringList(step.get("preserve"))) {
            if (pattern(pat).matcher(s).find()) return s;
        }

        boolean hasAlways = containsAny(s, always);
        boolean hasCond = containsAny(s, cond);
        if (!hasAlways && !hasCond) return s;

        List<String> all = new ArrayList<>(always);
        all.addAll(cond);
        List<String> tokAll = splitOn(s, all);
        List<String> tokAlways = hasAlways ? splitOn(s, always) : List.of(s.strip());

        String pgHit = null;
        for (String hint : stringList(step.get("pg_hints"))) {
            if (patternCi(hint).matcher(s).find()) { pgHit = hint; break; }
        }
        ctx.pgHint = pgHit;

        // 잘라낸 토큰이 전부 같으면 같은 곳을 두 번 적은 것이다.
        // "KIS정보통신-KIS정보통신", "(주)우아한형제들-주식회사 우아한형제들"
        if (tokAll.size() > 1 && List.copyOf(new java.util.LinkedHashSet<>(tokAll)).size() == 1) {
            ctx.collapsed = true;
            ctx.tokens = new ArrayList<>(List.of(tokAll.get(0)));
            return tokAll.get(0);
        }

        List<String> tokens;
        if (hasCond) {
            if (tokAll.size() >= minTokens || pgHit != null) { tokens = tokAll; ctx.condSplit = true; }
            else { tokens = tokAlways; ctx.condKept = true; }   // 상호명 안의 하이픈일 가능성
        } else {
            tokens = tokAlways;
        }

        if (Boolean.TRUE.equals(step.get("collapse_repeats"))) {
            List<String> uniq = new ArrayList<>();
            for (String t : tokens) if (!uniq.contains(t)) uniq.add(t);
            if (uniq.size() != tokens.size()) ctx.collapsed = true;
            tokens = uniq;
        }

        ctx.tokens = new ArrayList<>(tokens);
        return String.join(join, tokens);
    }

    private String stripSpecial(String s, Map<String, Object> step) {
        Object chars = step.get("chars");
        String cls = chars == null ? STRIP_SPECIAL_DEFAULT : String.valueOf(chars);
        return pattern(cls).matcher(s).replaceAll("");
    }

    private static String upperAscii(String s) {
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            sb.append(c < 128 ? Character.toUpperCase(c) : c);
        }
        return sb.toString();
    }

    /** 브랜드 사전 앞부분 대조(T4 1겹). 규칙은 normalize.yaml 의 resolve_brand 주석. */
    private String resolveBrand(String s, Ctx ctx, Map<String, Object> step) {
        String compact = s.replace(" ", "");
        for (String[] pair : brandAliases(step)) {
            String alias = pair[0];
            String brand = pair[1];
            if (!compact.startsWith(alias)) continue;
            String rest = compact.substring(alias.length());
            // 'CU' 뒤에 'TE' 가 오면 CUTE 라는 다른 단어다. 숫자 뒤 숫자는 지점 패턴이 가른다.
            if (!rest.isEmpty() && asciiAlpha(alias.charAt(alias.length() - 1)) && asciiAlpha(rest.charAt(0))) continue;
            if (ctx.isTruncated) {
                // 20B·괄호 미닫힘. 뒤가 잘려 지점 모양인지 알 수 없다. 사전 앞부분이 맞으면 복원한다.
                ctx.brandKey = brand;
                ctx.brandRestored = !rest.isEmpty();
                ctx.branchRaw = rest;
                return brand;
            }
            boolean branchLike = rest.isEmpty();
            for (String p : stringList(step.get("branch"))) {
                if (branchLike) break;
                branchLike = pattern(p).matcher(rest).find();
            }
            if (branchLike) {
                ctx.brandKey = brand;
                ctx.branch = rest;
                return brand;
            }
            return s;   // 뒤가 지점이 아니다(하위 업태 등). 별도 브랜드로 보고 떼지 않는다.
        }
        // 19B 의심: 이름이 사전 브랜드 중간에서 끝날 때(브랜드 앞부분만 일치)만 절단 확정.
        // 브랜드 전체가 이름에 들어 있으면 위에서 일반 매칭으로 끝나고 의심으로 남는다.
        if (ctx.truncationSuspect) {
            for (String[] pair : brandAliases(step)) {
                if (compact.length() < pair[0].length() && pair[0].startsWith(compact)) {
                    ctx.isTruncated = true;
                    ctx.brandKey = pair[1];
                    ctx.brandRestored = true;
                    ctx.branchRaw = "";
                    return pair[1];
                }
            }
        }
        return s;
    }

    /** (대조용 표기, 브랜드 키) 를 긴 표기부터. 표기는 공백 제거 + ASCII 대문자. */
    @SuppressWarnings("unchecked")
    private static List<String[]> brandAliases(Map<String, Object> step) {
        List<String[]> pairs = new ArrayList<>();
        Object brands = step.get("brands");
        if (brands instanceof List<?> list) {
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) continue;
                String key = String.valueOf(((Map<String, Object>) m).get("brand_key"));
                for (String a : stringList(((Map<String, Object>) m).get("aliases"))) {
                    pairs.add(new String[] { upperAscii(a.replace(" ", "")), key });
                }
            }
        }
        pairs.sort((x, y) -> x[0].length() != y[0].length()
                ? Integer.compare(y[0].length(), x[0].length()) : x[0].compareTo(y[0]));
        return pairs;
    }

    private static boolean asciiAlpha(char c) {
        return c < 128 && Character.isLetter(c);
    }

    private String stripBranch(String s, Ctx ctx, Map<String, Object> step) {
        if (!ctx.brandKey.isEmpty()) return s;   // resolve_brand 가 이미 지점을 뗐다
        if (Boolean.TRUE.equals(step.get("skip_if_truncated")) && ctx.isTruncated) {
            ctx.branchSkipped = true;
            ctx.branchRaw = s;
            return s;   // 뒤가 이미 잘려 있어 지점명 규칙이 엉뚱한 글자를 먹는다
        }
        int minKeep = intOf(step.get("min_keep"), 2);
        for (String pat : stringList(step.get("patterns"))) {
            String cand = pattern(pat).matcher(s).replaceAll("").strip();
            if (cand.equals(s)) continue;
            if (cand.codePointCount(0, cand.length()) >= minKeep) {
                // 떼어낸 부분이 지점명이다. 버리지 않고 보존한다(파이썬 branch 와 같은 값).
                ctx.branch = s.startsWith(cand)
                        ? s.substring(cand.length()).strip()
                        : s.replaceFirst(Pattern.quote(cand), "").strip();
                return cand;
            }
            ctx.branchBlocked.add(pat);   // 통째로 사라질 뻔했다 — 기록만 하고 다음 패턴으로
        }
        return s;
    }

    private String protectExceptions(String s, Ctx ctx) {
        for (int i = 0; i < exceptions.size(); i++) {
            String bare = exceptionsBare.get(i);
            if (bare.isEmpty() || !ctx.bareInput.contains(bare) || bare(s).contains(bare)) continue;
            // 예외 토큰이 축약 과정에서 사라졌다 -> 사라지기 직전 값으로 되돌린다
            for (int j = ctx.history.size() - 1; j >= 0; j--) {
                String prev = ctx.history.get(j);
                if (bare(prev).contains(bare)) {
                    ctx.protectedTokens.add(exceptions.get(i));
                    return prev;
                }
            }
        }
        return s;
    }

    // ---------------------------------------------------------------- 트랙 판정

    private boolean isOverseas(String raw, String bizNo) {
        if (!Boolean.FALSE.equals(overseas.get("require_no_bizno")) && !bizNo.isEmpty()) return false;
        int letters = count(LETTER, raw);
        if (letters == 0) return false;
        double ratio = (double) count(ASCII_LETTER, raw) / letters;
        return ratio >= doubleOf(overseas.get("ascii_letter_ratio_min"), 0.5);
    }

    // ---------------------------------------------------------------- 유틸

    private static String bare(String s) {
        return BARE.matcher(s == null ? "" : s).replaceAll("").toUpperCase(Locale.ROOT);
    }

    private static int count(Pattern p, String s) {
        Matcher m = p.matcher(s == null ? "" : s);
        int n = 0;
        while (m.find()) n++;
        return n;
    }

    private static boolean containsAny(String s, List<String> delims) {
        for (String d : delims) if (s.contains(d)) return true;
        return false;
    }

    /** 구분자 문자 클래스로 자르고, 각 토큰을 trim 한 뒤 빈 토큰은 버린다. */
    private static List<String> splitOn(String text, List<String> delims) {
        if (delims.isEmpty()) {
            String t = text.strip();
            return t.isEmpty() ? List.of() : List.of(t);
        }
        String cls = "[\\Q" + String.join("", delims) + "\\E]";
        List<String> out = new ArrayList<>();
        for (String part : text.split(cls, -1)) {
            String t = part.strip();
            if (!t.isEmpty()) out.add(t);
        }
        return out;
    }

    private Pattern pattern(String regex) {
        return cache.computeIfAbsent(regex, r -> Pattern.compile(r, FLAGS));
    }

    private Pattern patternCi(String regex) {
        return cacheCi.computeIfAbsent(regex,
                r -> Pattern.compile(r, FLAGS | Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE));
    }

    @SuppressWarnings("unchecked")
    private static List<String> stringList(Object o) {
        if (!(o instanceof List)) return List.of();
        List<String> out = new ArrayList<>();
        for (Object v : (List<Object>) o) out.add(String.valueOf(v));
        return out;
    }

    private static int intOf(Object o, int fallback) {
        return o instanceof Number n ? n.intValue() : fallback;
    }

    private static double doubleOf(Object o, double fallback) {
        return o instanceof Number n ? n.doubleValue() : fallback;
    }

    /** 파이프라인이 단계 사이에 들고 다니는 상태. */
    private static final class Ctx {
        final String bareInput;
        final List<String> history = new ArrayList<>();
        List<String> tokens = new ArrayList<>();
        final List<String> branchBlocked = new ArrayList<>();
        final List<String> protectedTokens = new ArrayList<>();
        boolean isTruncated, branchSkipped, condSplit, condKept, collapsed;
        boolean truncationSuspect, brandRestored;
        int encBytes;
        String pgHint;
        String brandKey = "", branch = "", branchRaw = "";

        Ctx(String bareInput) { this.bareInput = bareInput; }
    }
}
