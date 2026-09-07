package kr.taxmate.preprocess.t1;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * rules/normalize.yaml 을 읽기 위한 최소 YAML 리더.
 *
 * <p>범용 파서가 아니다. 이 프로젝트의 룰 파일이 쓰는 문법만 다룬다 —
 * 블록 맵·블록 시퀀스·플로우 맵·플로우 시퀀스·따옴표 스칼라·{@code |} 블록 스칼라.
 * 앵커, 태그, 멀티 도큐먼트, 복합 키는 지원하지 않는다.
 *
 * <p>백엔드(Spring Boot)에는 SnakeYAML 이 이미 딸려 오므로 그쪽에서는
 * {@code new Yaml().load(...)} 로 갈아끼우면 된다. 반환 타입을 일부러
 * {@code Map<String,Object>} 로 맞춰 둔 이유가 그것이다.
 *
 * <p>이 리더를 따로 만든 이유: 검증 환경에서 Maven Central 이 막혀 있어
 * SnakeYAML 을 받을 수 없다. 정책을 우회하지 않고 이 파일 모양만 읽는다.
 */
public final class MiniYaml {

    private final List<Line> lines = new ArrayList<>();
    private int cursor = 0;

    private MiniYaml(String text) {
        for (String rawLine : text.split("\\R", -1)) {
            String content = stripComment(rawLine);
            if (content.isBlank()) continue;
            int indent = 0;
            while (indent < content.length() && content.charAt(indent) == ' ') indent++;
            lines.add(new Line(indent, content.substring(indent)));
        }
    }

    public static Map<String, Object> load(Path path) throws IOException {
        return load(Files.readString(path, StandardCharsets.UTF_8));
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> load(String text) {
        MiniYaml y = new MiniYaml(text);
        if (y.lines.isEmpty()) return new LinkedHashMap<>();
        Object root = y.parseNode(y.lines.get(0).indent);
        if (root instanceof Map) return (Map<String, Object>) root;
        throw new IllegalArgumentException("최상위가 맵이 아니다");
    }

    // ------------------------------------------------------------------ 블록

    private Object parseNode(int indent) {
        Line line = lines.get(cursor);
        return line.text.equals("-") || line.text.startsWith("- ")
                ? parseSequence(indent)
                : parseMapping(indent);
    }

    private List<Object> parseSequence(int indent) {
        List<Object> out = new ArrayList<>();
        while (cursor < lines.size()) {
            Line line = lines.get(cursor);
            if (line.indent != indent) break;
            if (!line.text.equals("-") && !line.text.startsWith("- ")) break;

            String rest = line.text.equals("-") ? "" : line.text.substring(2).trim();
            int childIndent = indent + 2;
            cursor++;

            if (rest.isEmpty()) {
                out.add(cursor < lines.size() && lines.get(cursor).indent > indent
                        ? parseNode(lines.get(cursor).indent) : null);
            } else if (splitKey(rest) >= 0) {
                // "- id: strip_corp" 처럼 항목이 맵으로 시작한다.
                // 그 줄을 childIndent 짜리 맵의 첫 줄로 되돌려 넣고 이어서 읽는다.
                lines.add(cursor, new Line(childIndent, rest));
                out.add(parseMapping(childIndent));
            } else {
                out.add(scalar(rest));
            }
        }
        return out;
    }

    private Map<String, Object> parseMapping(int indent) {
        Map<String, Object> out = new LinkedHashMap<>();
        while (cursor < lines.size()) {
            Line line = lines.get(cursor);
            if (line.indent != indent) break;
            int colon = splitKey(line.text);
            if (colon < 0) break;

            String key = unquote(line.text.substring(0, colon).trim());
            String rest = line.text.substring(colon + 1).trim();
            cursor++;

            if (rest.equals("|") || rest.equals("|-") || rest.equals(">")) {
                out.put(key, blockScalar(indent));
            } else if (rest.isEmpty()) {
                out.put(key, cursor < lines.size() && lines.get(cursor).indent > indent
                        ? parseNode(lines.get(cursor).indent)
                        : (cursor < lines.size() && lines.get(cursor).indent == indent
                           && lines.get(cursor).text.startsWith("- ")
                                ? parseSequence(indent) : null));
            } else {
                out.put(key, scalar(rest));
            }
        }
        return out;
    }

    private String blockScalar(int parentIndent) {
        StringBuilder sb = new StringBuilder();
        while (cursor < lines.size() && lines.get(cursor).indent > parentIndent) {
            sb.append(lines.get(cursor).text).append('\n');
            cursor++;
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------ 스칼라

    private static Object scalar(String s) {
        s = s.trim();
        if (s.startsWith("{")) return flowMap(s);
        if (s.startsWith("[")) return flowSeq(s);
        if (s.startsWith("\"") || s.startsWith("'")) return unquote(s);
        if (s.equals("true")) return Boolean.TRUE;
        if (s.equals("false")) return Boolean.FALSE;
        if (s.equals("null") || s.equals("~")) return null;
        if (s.matches("-?\\d+")) return Integer.valueOf(s);
        if (s.matches("-?\\d+\\.\\d+")) return Double.valueOf(s);
        return s;
    }

    private static Map<String, Object> flowMap(String s) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (String part : splitTop(s.substring(1, s.length() - 1))) {
            if (part.isBlank()) continue;
            int colon = splitKey(part);
            if (colon < 0) throw new IllegalArgumentException("플로우 맵 항목이 이상하다: " + part);
            out.put(unquote(part.substring(0, colon).trim()), scalar(part.substring(colon + 1)));
        }
        return out;
    }

    private static List<Object> flowSeq(String s) {
        List<Object> out = new ArrayList<>();
        for (String part : splitTop(s.substring(1, s.length() - 1))) {
            if (!part.isBlank()) out.add(scalar(part));
        }
        return out;
    }

    /** 따옴표와 중첩 괄호 밖의 쉼표로만 자른다. */
    private static List<String> splitTop(String s) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        char quote = 0;
        int depth = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (quote != 0) {
                cur.append(c);
                if (c == '\\' && quote == '"' && i + 1 < s.length()) { cur.append(s.charAt(++i)); continue; }
                if (c == quote) quote = 0;
                continue;
            }
            switch (c) {
                case '"': case '\'': quote = c; cur.append(c); break;
                case '{': case '[': depth++; cur.append(c); break;
                case '}': case ']': depth--; cur.append(c); break;
                case ',':
                    if (depth == 0) { out.add(cur.toString()); cur.setLength(0); }
                    else cur.append(c);
                    break;
                default: cur.append(c);
            }
        }
        out.add(cur.toString());
        return out;
    }

    /** 따옴표·괄호 밖의 첫 {@code ": "} 또는 줄 끝 {@code ":"} 위치. 없으면 -1. */
    private static int splitKey(String s) {
        char quote = 0;
        int depth = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (quote != 0) {
                if (c == '\\' && quote == '"') { i++; continue; }
                if (c == quote) quote = 0;
                continue;
            }
            if (c == '"' || c == '\'') { quote = c; continue; }
            if (c == '{' || c == '[') { depth++; continue; }
            if (c == '}' || c == ']') { depth--; continue; }
            if (c == ':' && depth == 0 && (i + 1 == s.length() || s.charAt(i + 1) == ' ')) return i;
        }
        return -1;
    }

    private static String unquote(String s) {
        s = s.trim();
        if (s.length() >= 2 && s.charAt(0) == '\'' && s.endsWith("'")) {
            return s.substring(1, s.length() - 1).replace("''", "'");
        }
        if (s.length() >= 2 && s.charAt(0) == '"' && s.endsWith("\"")) {
            String body = s.substring(1, s.length() - 1);
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < body.length(); i++) {
                char c = body.charAt(i);
                if (c != '\\' || i + 1 >= body.length()) { sb.append(c); continue; }
                char n = body.charAt(++i);
                switch (n) {
                    case 'n': sb.append('\n'); break;
                    case 't': sb.append('\t'); break;
                    case 'r': sb.append('\r'); break;
                    case '0': sb.append('\0'); break;
                    default: sb.append(n);      // \\ \" \/ 등은 뒤 글자만 남긴다
                }
            }
            return sb.toString();
        }
        return s;
    }

    /** 따옴표 밖의 {@code #} 부터가 주석이다. {@code chars: "[.*#/...]"} 를 지키기 위해 필요하다. */
    private static String stripComment(String line) {
        char quote = 0;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (quote != 0) {
                if (c == '\\' && quote == '"') { i++; continue; }
                if (c == quote) quote = 0;
                continue;
            }
            if (c == '"' || c == '\'') { quote = c; continue; }
            if (c == '#' && (i == 0 || line.charAt(i - 1) == ' ')) return line.substring(0, i);
        }
        return line;
    }

    private record Line(int indent, String text) {}
}
