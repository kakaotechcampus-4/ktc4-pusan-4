package com.ktc4.pusan4.judgment.rule;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.fasterxml.jackson.dataformat.yaml.YAMLGenerator;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * 업종 프로파일({@code profiles/*.yaml})에서 {@code 통상}인 칸마다 G2 카드를 만든다.
 *
 * <p>G2 는 §27① 통상성 판단이다. 프로파일이 통상이라고 하면 물어볼 것 없이 가능이라 기계적으로 만들 수 있다.
 * 조건부·비통상은 무엇을 어떻게 물을지, 결제 내역만으로 확정해도 되는지를 업종과 카테고리를 보고
 * 사람이 설계해야 해서 만들지 않는다. 그 칸은 사람이 쓴 카드({@code match.industry} 고정)가 맡는다.
 *
 * <p>통상 카드도 카테고리마다 계정과목·인용 조문·금액 조건이 달라서 템플릿({@code rules/templates/})을 둔다.
 * 템플릿은 {@code match.industry} 만 뺀 카드다. 만든 카드는 {@code rules/cards/} 에 평평하게 둔다.
 * 카드 ID 는 {@code R-<업종 6자리><템플릿 번호 3자리>}, version 은 템플릿 version × 100 + 프로파일 version 이다.
 */
public final class ProfileCardGenerator {

    static final String ORDINARY = "통상";
    static final Pattern GENERATED_FILE = Pattern.compile("R-\\d{9}_.+\\.yaml");
    private static final Pattern TEMPLATE_ID = Pattern.compile("R-(\\d{3})");
    private static final Pattern INDUSTRY_CODE = Pattern.compile("\\d{6}");

    private static final ObjectMapper YAML = new ObjectMapper(new YAMLFactory()
        .disable(YAMLGenerator.Feature.WRITE_DOC_START_MARKER)
        .enable(YAMLGenerator.Feature.MINIMIZE_QUOTES)
        .enable(YAMLGenerator.Feature.ALWAYS_QUOTE_NUMBERS_AS_STRINGS));

    private ProfileCardGenerator() {
    }

    /** 파일 이름 → 카드 YAML. 이름 순서로 정렬해 돌려준다. */
    public static Map<String, String> generate(Path templatesDirectory, Path profilesDirectory) throws IOException {
        Map<String, Template> templates = templates(templatesDirectory);
        Map<String, String> cards = new TreeMap<>();
        for (Profile profile : profiles(profilesDirectory)) {
            for (Map.Entry<String, String> cell : profile.cells().entrySet()) {
                if (!cell.getValue().equals(ORDINARY)) {
                    continue;
                }
                Template template = templates.get(cell.getKey());
                if (template == null) {
                    throw new RuleCardValidationException("profiles/" + profile.industryCode() + ".yaml "
                        + cell.getKey() + " 는 통상인데 rules/templates 에 템플릿이 없다");
                }
                String cardId = "R-" + profile.industryCode() + template.number();
                String fileName = template.fileName().replaceFirst("^" + template.id(), cardId);
                cards.put(fileName, header(template, profile) + YAML.writeValueAsString(
                    card(template.root(), cardId, profile)));
            }
        }
        return cards;
    }

    /** {@code rules/cards/} 의 생성 파일을 모두 지우고 다시 쓴다. 통상이 아니게 된 칸의 카드는 자연히 사라진다. */
    public static void main(String[] args) throws IOException {
        Path rulesDirectory = Path.of(args[0]);
        Path profilesDirectory = Path.of(args[1]);
        Map<String, String> cards = generate(rulesDirectory.resolve("templates"), profilesDirectory);
        Path cardsDirectory = rulesDirectory.resolve("cards");
        for (Path stale : generatedFiles(cardsDirectory)) {
            Files.delete(stale);
        }
        for (Map.Entry<String, String> card : cards.entrySet()) {
            Files.writeString(cardsDirectory.resolve(card.getKey()), card.getValue());
        }
        System.out.println("generated " + cards.size() + " cards into " + cardsDirectory);
    }

    static List<Path> generatedFiles(Path cardsDirectory) throws IOException {
        try (Stream<Path> files = Files.list(cardsDirectory)) {
            return files.filter(path -> GENERATED_FILE.matcher(path.getFileName().toString()).matches())
                .sorted()
                .toList();
        }
    }

    static List<Profile> profiles(Path profilesDirectory) throws IOException {
        List<Profile> profiles = new ArrayList<>();
        for (Path file : yamlFiles(profilesDirectory)) {
            JsonNode root = YAML.readTree(file.toFile());
            String industryCode = root.path("industry_code").asText();
            if (!INDUSTRY_CODE.matcher(industryCode).matches()) {
                throw new RuleCardValidationException(file + ": industry_code must be 6 digits");
            }
            int version = root.path("version").asInt();
            if (version < 1 || version > 99) {
                throw new RuleCardValidationException(file + ": version must be 1..99");
            }
            Map<String, String> cells = new TreeMap<>();
            root.path("통상성").properties().forEach(cell -> cells.put(cell.getKey(), cell.getValue().asText()));
            profiles.add(new Profile(industryCode, version, cells));
        }
        return profiles;
    }

    private static Map<String, Template> templates(Path templatesDirectory) throws IOException {
        Map<String, Template> templates = new HashMap<>();
        for (Path file : yamlFiles(templatesDirectory)) {
            Template template = template(file);
            Template previous = templates.put(template.category(), template);
            if (previous != null) {
                throw new RuleCardValidationException(template.id() + " and " + previous.id() + ": same category");
            }
        }
        return templates;
    }

    private static Template template(Path file) throws IOException {
        JsonNode root = YAML.readTree(file.toFile());
        String id = root.path("id").asText();
        Matcher idMatch = TEMPLATE_ID.matcher(id);
        if (!idMatch.matches()) {
            throw new RuleCardValidationException(file + ": template id must look like R-102");
        }
        if (root.path("version").asInt() < 1) {
            throw new RuleCardValidationException(id + ": template version must be >= 1");
        }
        if (!root.path("verdict").asText().equals("가능")) {
            throw new RuleCardValidationException(id + ": 통상 템플릿의 verdict 는 가능이어야 한다");
        }
        String category = category(id, root.path("match"));
        return new Template(id, idMatch.group(1), category, file.getFileName().toString(), root);
    }

    private static String category(String id, JsonNode match) {
        if (match.has("industry")) {
            throw new RuleCardValidationException(id + ": template must not set match.industry");
        }
        JsonNode categories = match.path("category");
        if (!categories.isArray() || categories.size() != 1) {
            throw new RuleCardValidationException(id + ": template needs exactly one match.category");
        }
        return categories.get(0).asText();
    }

    private static ObjectNode card(JsonNode template, String cardId, Profile profile) {
        ObjectNode card = YAML.createObjectNode();
        card.put("id", cardId);
        card.put("version", template.path("version").asInt() * 100 + profile.version());
        template.properties().forEach(field -> {
            switch (field.getKey()) {
                case "id", "version" -> { }
                case "match" -> {
                    ObjectNode match = field.getValue().deepCopy();
                    match.putArray("industry").add(profile.industryCode());
                    card.set("match", match);
                }
                default -> card.set(field.getKey(), field.getValue().deepCopy());
            }
        });
        return card;
    }

    private static String header(Template template, Profile profile) {
        return """
            # 생성 파일이다. 직접 고치지 않는다.
            # 원본: rules/templates/%s + profiles/%s.yaml
            # 다시 만들기: ./backend/gradlew -p backend generateRuleCards
            """.formatted(template.fileName(), profile.industryCode());
    }

    private static List<Path> yamlFiles(Path directory) throws IOException {
        try (Stream<Path> files = Files.list(directory)) {
            return files.filter(path -> path.getFileName().toString().endsWith(".yaml")).sorted().toList();
        }
    }

    record Profile(String industryCode, int version, Map<String, String> cells) {
    }

    private record Template(String id, String number, String category, String fileName, JsonNode root) {
    }
}
