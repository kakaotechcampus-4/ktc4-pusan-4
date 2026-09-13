package com.ktc4.pusan4.judgment.rule;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.ktc4.pusan4.judgment.domain.Citation;
import com.ktc4.pusan4.judgment.domain.Gate;
import com.ktc4.pusan4.judgment.domain.QuestionEffect;
import com.ktc4.pusan4.judgment.domain.QuestionSpec;
import com.ktc4.pusan4.judgment.domain.RuleCard;
import com.ktc4.pusan4.judgment.domain.RuleMatch;
import com.ktc4.pusan4.judgment.domain.RuleSet;
import com.ktc4.pusan4.judgment.domain.Verdict;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

public final class RuleCardLoader {

    private static final Comparator<RuleCard> ORDER = Comparator
        .comparingInt(RuleCard::priority).reversed()
        .thenComparing(RuleCard::id);

    private final ObjectMapper mapper = new ObjectMapper(new YAMLFactory());

    // 허용 어휘의 단일 원본은 rules/categories.yaml 이다(Python 검증기와 공유).
    // 파일이 없으면 빈 집합으로 두어 카테고리 검증을 건너뛴다.
    private Set<String> categoryVocabulary = Set.of();

    public RuleSet load(Path rulesDirectory) throws IOException {
        Path cardsDirectory = rulesDirectory.resolve("cards");
        if (!Files.isDirectory(cardsDirectory)) {
            throw new RuleCardValidationException("Rule cards directory does not exist: " + cardsDirectory);
        }
        categoryVocabulary = loadCategoryVocabulary(rulesDirectory.resolve("categories.yaml"));

        List<RuleCard> cards;
        try (Stream<Path> files = Files.list(cardsDirectory)) {
            cards = files
                .filter(path -> path.getFileName().toString().endsWith(".yaml"))
                .map(this::readUnchecked)
                .sorted(ORDER)
                .toList();
        }
        validateUniqueIds(cards);
        validateBlockingConflicts(cards);
        validateAttributeConflicts(cards);
        return new RuleSet(cards);
    }

    private RuleCard readUnchecked(Path path) {
        try {
            return read(path);
        } catch (IOException | RuntimeException exception) {
            if (exception instanceof RuleCardValidationException validationException) {
                throw validationException;
            }
            throw new RuleCardValidationException(path + ": " + exception.getMessage());
        }
    }

    private RuleCard read(Path path) throws IOException {
        JsonNode root = mapper.readTree(path.toFile());
        String id = requiredText(root, "id");
        int version = requiredInt(root, "version");
        Gate gate = enumValue(Gate.class, requiredText(root, "gate"), "gate");
        int priority = requiredInt(root, "priority");
        // 기본룰(큐레이션 카드)은 401 이상. 400 이하는 학습룰 대역이라, 검증된 카드가
        // 학습룰에 밀리지 않도록 로딩 시 거부한다.
        if (priority < 401) {
            throw new RuleCardValidationException(
                id + ": priority must be 401 or higher (401+ is reserved for base rules)");
        }

        JsonNode period = first(root, "effective_period", "효력기간");
        if (period == null || period.isMissingNode()) {
            throw new RuleCardValidationException(id + ": effective period is required");
        }
        LocalDate effectiveFrom = LocalDate.parse(requiredText(period, "start", "시작"));
        LocalDate effectiveTo = optionalDate(period, "end", "종료");
        if (effectiveTo != null && effectiveTo.isBefore(effectiveFrom)) {
            throw new RuleCardValidationException(id + ": effective period ends before it starts");
        }

        JsonNode match = root.path("match");
        if (match.isMissingNode()) {
            throw new RuleCardValidationException(id + ": match is required");
        }
        RuleMatch ruleMatch = new RuleMatch(
            strings(match, "category"),
            strings(match, "exclude_category"),
            strings(match, "keyword"),
            optionalLong(match, "amount_min"),
            optionalLong(match, "amount_max"),
            strings(match, "industry")
        );
        validateCategories(id, ruleMatch);

        Verdict verdict = root.hasNonNull("verdict")
            ? verdictValue(root.get("verdict").asText())
            : null;
        if ((gate == Gate.G1 || gate == Gate.G2) && verdict == null) {
            throw new RuleCardValidationException(id + ": blocking gate requires verdict");
        }

        List<Citation> citations = citations(root.path("citations"));
        if ((verdict == Verdict.AVAILABLE || verdict == Verdict.UNAVAILABLE) && citations.isEmpty()) {
            throw new RuleCardValidationException(id + ": final verdict requires citation");
        }

        List<QuestionSpec> questions = questions(root);
        boolean hasFinalEffectVerdict = questions.stream()
            .flatMap(question -> question.effects().values().stream())
            .map(QuestionEffect::verdict)
            .anyMatch(effectVerdict ->
                effectVerdict == Verdict.AVAILABLE || effectVerdict == Verdict.UNAVAILABLE);
        if (hasFinalEffectVerdict && citations.isEmpty()) {
            throw new RuleCardValidationException(id + ": effect verdict requires citation");
        }

        JsonNode review = root.path("review");
        String reviewedBy = requiredText(review, "by");
        LocalDate reviewedAt = LocalDate.parse(requiredText(review, "date"));

        return new RuleCard(
            id, version, gate, priority, ruleMatch, verdict, optionalText(root, "account"), citations,
            objectMap(root.path("attributes")), questions,
            effectiveFrom, effectiveTo, reviewedBy, reviewedAt
        );
    }

    private void validateUniqueIds(List<RuleCard> cards) {
        Set<String> ids = new HashSet<>();
        for (RuleCard card : cards) {
            if (!ids.add(card.id())) {
                throw new RuleCardValidationException("Duplicate rule card id: " + card.id());
            }
        }
    }

    private void validateBlockingConflicts(List<RuleCard> cards) {
        for (int leftIndex = 0; leftIndex < cards.size(); leftIndex++) {
            RuleCard left = cards.get(leftIndex);
            if (left.gate() != Gate.G1 && left.gate() != Gate.G2) {
                continue;
            }
            for (int rightIndex = leftIndex + 1; rightIndex < cards.size(); rightIndex++) {
                RuleCard right = cards.get(rightIndex);
                if (left.gate() == right.gate()
                    && left.priority() == right.priority()
                    && left.match().specificity() == right.match().specificity()
                    && periodsOverlap(left, right)
                    && matchesOverlap(left.match(), right.match())) {
                    throw new RuleCardValidationException(
                        "Conflicting blocking rules: " + left.id() + " and " + right.id()
                    );
                }
            }
        }
    }

    private void validateAttributeConflicts(List<RuleCard> cards) {
        for (int leftIndex = 0; leftIndex < cards.size(); leftIndex++) {
            RuleCard left = cards.get(leftIndex);
            if (left.gate() == Gate.G1 || left.gate() == Gate.G2) {
                continue;
            }
            for (int rightIndex = leftIndex + 1; rightIndex < cards.size(); rightIndex++) {
                RuleCard right = cards.get(rightIndex);
                if (right.gate() == Gate.G1 || right.gate() == Gate.G2) {
                    continue;
                }
                if (!periodsOverlap(left, right) || !matchesOverlap(left.match(), right.match())) {
                    continue;
                }
                for (Map.Entry<String, Object> entry : left.attributes().entrySet()) {
                    Object rightValue = right.attributes().get(entry.getKey());
                    if (rightValue != null && !rightValue.equals(entry.getValue())) {
                        throw new RuleCardValidationException(
                            "Conflicting attribute '" + entry.getKey() + "' in "
                                + left.id() + " and " + right.id()
                        );
                    }
                }
            }
        }
    }

    private static boolean periodsOverlap(RuleCard left, RuleCard right) {
        LocalDate leftEnd = left.effectiveTo() == null ? LocalDate.MAX : left.effectiveTo();
        LocalDate rightEnd = right.effectiveTo() == null ? LocalDate.MAX : right.effectiveTo();
        return !leftEnd.isBefore(right.effectiveFrom()) && !rightEnd.isBefore(left.effectiveFrom());
    }

    private static boolean matchesOverlap(RuleMatch left, RuleMatch right) {
        if (!rangesOverlap(left.amountMin(), left.amountMax(), right.amountMin(), right.amountMax())) {
            return false;
        }
        if (!listsOverlap(left.industries(), right.industries())) {
            return false;
        }
        return categoriesOverlap(left, right);
    }

    private static boolean categoriesOverlap(RuleMatch left, RuleMatch right) {
        if (left.categories().isEmpty() && right.categories().isEmpty()) {
            return true;
        }
        if (left.categories().isEmpty()) {
            return right.categories().stream()
                .anyMatch(category -> !left.excludedCategories().contains(category));
        }
        if (right.categories().isEmpty()) {
            return left.categories().stream()
                .anyMatch(category -> !right.excludedCategories().contains(category));
        }
        return left.categories().stream().anyMatch(category ->
            right.categories().contains(category)
                && !left.excludedCategories().contains(category)
                && !right.excludedCategories().contains(category)
        );
    }

    private static boolean listsOverlap(List<String> left, List<String> right) {
        return left.isEmpty() || right.isEmpty() || left.stream().anyMatch(right::contains);
    }

    private static boolean rangesOverlap(Long leftMin, Long leftMax, Long rightMin, Long rightMax) {
        long effectiveLeftMin = leftMin == null ? Long.MIN_VALUE : leftMin;
        long effectiveLeftMax = leftMax == null ? Long.MAX_VALUE : leftMax;
        long effectiveRightMin = rightMin == null ? Long.MIN_VALUE : rightMin;
        long effectiveRightMax = rightMax == null ? Long.MAX_VALUE : rightMax;
        return effectiveLeftMin <= effectiveRightMax && effectiveRightMin <= effectiveLeftMax;
    }

    private List<QuestionSpec> questions(JsonNode root) {
        JsonNode question = root.path("question");
        if (question.isMissingNode()) {
            return List.of();
        }
        List<String> options = new ArrayList<>();
        Map<String, QuestionEffect> effects = new java.util.LinkedHashMap<>();
        question.path("options").forEach(option -> {
            String value = option.isTextual() ? option.asText() : requiredText(option, "value");
            options.add(value);
            if (option.isObject()) {
                Map<String, Object> attributes = new java.util.LinkedHashMap<>(objectMap(option));
                attributes.remove("value");
                attributes.remove("verdict");
                attributes.remove("account");
                effects.put(value, new QuestionEffect(
                    option.hasNonNull("verdict")
                        ? verdictValue(option.get("verdict").asText())
                        : null,
                    optionalText(option, "account"),
                    attributes
                ));
            }
        });
        return List.of(new QuestionSpec(
            optionalText(question, "code") == null ? "RULE_QUESTION" : optionalText(question, "code"),
            requiredText(question, "text"),
            requiredText(question, "fact_type"),
            requiredText(question, "group_by"),
            options,
            effects
        ));
    }

    private List<Citation> citations(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<Citation> citations = new ArrayList<>();
        node.forEach(value -> citations.add(new Citation(
            value.isTextual() ? value.asText() : requiredText(value, "id")
        )));
        return List.copyOf(citations);
    }

    private Map<String, Object> objectMap(JsonNode node) {
        if (!node.isObject()) {
            return Map.of();
        }
        return mapper.convertValue(node, new TypeReference<>() { });
    }

    private static JsonNode first(JsonNode node, String... fields) {
        for (String field : fields) {
            if (node.has(field)) {
                return node.get(field);
            }
        }
        return null;
    }

    private static String requiredText(JsonNode node, String... fields) {
        JsonNode value = first(node, fields);
        if (value == null || value.isNull() || value.asText().isBlank()) {
            throw new RuleCardValidationException("Required field is missing: " + String.join("/", fields));
        }
        return value.asText();
    }

    private static int requiredInt(JsonNode node, String field) {
        if (!node.has(field) || !node.get(field).canConvertToInt()) {
            throw new RuleCardValidationException("Required integer is missing: " + field);
        }
        return node.get(field).intValue();
    }

    private static String optionalText(JsonNode node, String field) {
        return node.hasNonNull(field) ? node.get(field).asText() : null;
    }

    private static Long optionalLong(JsonNode node, String field) {
        return node.hasNonNull(field) ? node.get(field).longValue() : null;
    }

    private static LocalDate optionalDate(JsonNode node, String... fields) {
        JsonNode value = first(node, fields);
        return value == null || value.isNull() ? null : LocalDate.parse(value.asText());
    }

    private Set<String> loadCategoryVocabulary(Path categoriesFile) throws IOException {
        if (!Files.exists(categoriesFile)) {
            return Set.of();
        }
        JsonNode names = mapper.readTree(categoriesFile.toFile()).path("categories");
        if (!names.isArray()) {
            throw new RuleCardValidationException("categories.yaml: categories must be a list");
        }
        Set<String> vocabulary = new HashSet<>();
        names.forEach(name -> vocabulary.add(name.asText()));
        return Set.copyOf(vocabulary);
    }

    private void validateCategories(String id, RuleMatch match) {
        if (categoryVocabulary.isEmpty()) {
            return;
        }
        for (String category : match.categories()) {
            if (!categoryVocabulary.contains(category)) {
                throw new RuleCardValidationException(id + ": category '" + category + "' not in vocabulary");
            }
        }
        for (String category : match.excludedCategories()) {
            if (!categoryVocabulary.contains(category)) {
                throw new RuleCardValidationException(
                    id + ": exclude_category '" + category + "' not in vocabulary");
            }
        }
    }

    private static List<String> strings(JsonNode node, String field) {
        JsonNode values = node.path(field);
        if (values.isMissingNode() || values.isNull()) {
            return List.of();
        }
        if (!values.isArray()) {
            throw new RuleCardValidationException(field + " must be a list");
        }
        List<String> result = new ArrayList<>();
        values.forEach(value -> result.add(value.asText()));
        return List.copyOf(result);
    }

    private static <T extends Enum<T>> T enumValue(Class<T> type, String value, String field) {
        try {
            return Enum.valueOf(type, value);
        } catch (IllegalArgumentException exception) {
            throw new RuleCardValidationException("Invalid " + field + ": " + value);
        }
    }

    private static Verdict verdictValue(String value) {
        return switch (value) {
            case "가능" -> Verdict.AVAILABLE;
            case "불가" -> Verdict.UNAVAILABLE;
            case "확인필요", "확인 필요" -> Verdict.NEEDS_REVIEW;
            default -> enumValue(Verdict.class, value, "verdict");
        };
    }
}
