package kr.taxmate.preprocess.t1;

import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 의존성 없는 러너. 빌드 도구 없이 javac 만으로 돌린다.
 *
 * <pre>
 *   java -cp out kr.taxmate.preprocess.t1.T1Cli --selftest  rules/normalize.yaml
 *   java -cp out kr.taxmate.preprocess.t1.T1Cli --dump-spec rules/normalize.yaml
 *   java -cp out kr.taxmate.preprocess.t1.T1Cli --batch     rules/normalize.yaml cases.tsv
 *   java -cp out kr.taxmate.preprocess.t1.T1Cli --text      rules/normalize.yaml "스타벅스코리아 강남대로점"
 * </pre>
 */
public final class T1Cli {

    public static void main(String[] args) throws Exception {
        PrintStream out = new PrintStream(System.out, true, StandardCharsets.UTF_8);
        if (args.length < 2) { out.println("usage: --selftest|--dump-spec|--batch|--text <normalize.yaml> [arg]"); return; }

        String mode = args[0];
        Map<String, Object> spec = MiniYaml.load(Path.of(args[1]));
        T1Normalizer norm = new T1Normalizer(spec);

        switch (mode) {
            case "--selftest" -> System.exit(selftest(norm, out));
            case "--dump-spec" -> out.println(json(spec));
            case "--text" -> out.println(tsv(norm.normalize(args[2])));
            case "--batch" -> {
                for (String line : Files.readAllLines(Path.of(args[2]), StandardCharsets.UTF_8)) {
                    if (line.isEmpty()) continue;
                    String[] f = line.split("\t", -1);
                    out.println(tsv(norm.normalize(f[0], f.length > 1 ? f[1] : "")));
                }
            }
            default -> out.println("알 수 없는 모드: " + mode);
        }
    }

    @SuppressWarnings("unchecked")
    private static int selftest(T1Normalizer norm, PrintStream out) {
        List<Map<String, Object>> cases =
                (List<Map<String, Object>>) norm.spec().getOrDefault("test_cases", List.of());
        int bad = 0;
        for (Map<String, Object> c : cases) {
            String in = String.valueOf(c.get("in"));
            String want = String.valueOf(c.get("out"));
            String got = norm.stringKey(in);
            if (!got.equals(want)) {
                bad++;
                out.printf("  FAIL  %-30s -> %-24s (기대 %s)%n", in, got, want);
            }
        }
        out.printf("%n  %d/%d 통과%n", cases.size() - bad, cases.size());
        return bad == 0 ? 0 : 1;
    }

    /** 파이썬 출력과 문자 단위로 비교하기 위한 고정 포맷. */
    private static String tsv(T1Result r) {
        return String.join("\t",
                r.raw(), r.normKey(), r.track(), r.stringNorm(), r.overseasNorm(),
                String.join(",", r.tokens()),
                String.valueOf(r.truncated()), String.valueOf(r.overseas()),
                String.valueOf(r.encBytes()), String.valueOf(r.branchSkipped()),
                String.valueOf(r.branchBlocked().size()),
                String.join(",", r.protectedTokens()),
                r.pgHint() == null ? "" : r.pgHint(),
                String.valueOf(r.condSplit()), String.valueOf(r.condKept()),
                String.valueOf(r.collapsed()));
    }

    // ---------------------------------------------------------------- 정규 JSON
    // MiniYaml 이 파이썬 yaml.safe_load 와 같은 구조를 만들었는지 대조하기 위한 것.

    private static String json(Object o) {
        StringBuilder sb = new StringBuilder();
        write(o, sb);
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private static void write(Object o, StringBuilder sb) {
        if (o == null) { sb.append("null"); return; }
        if (o instanceof Map<?, ?> m) {
            sb.append('{');
            boolean first = true;
            for (Map.Entry<String, Object> e : new TreeMap<>((Map<String, Object>) m).entrySet()) {
                if (!first) sb.append(',');
                first = false;
                quote(e.getKey(), sb);
                sb.append(':');
                write(e.getValue(), sb);
            }
            sb.append('}');
            return;
        }
        if (o instanceof List<?> l) {
            sb.append('[');
            for (int i = 0; i < l.size(); i++) {
                if (i > 0) sb.append(',');
                write(l.get(i), sb);
            }
            sb.append(']');
            return;
        }
        if (o instanceof Boolean || o instanceof Number) { sb.append(o); return; }
        quote(String.valueOf(o), sb);
    }

    private static void quote(String s, StringBuilder sb) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
                }
            }
        }
        sb.append('"');
    }
}
