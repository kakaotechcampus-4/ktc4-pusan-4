package com.ktc4.pusan4.eval;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.ktc4.pusan4.judgment.domain.Gate;
import com.ktc4.pusan4.judgment.domain.TransactionInput;
import com.ktc4.pusan4.judgment.domain.UserContext;
import com.ktc4.pusan4.judgment.domain.UserFact;
import com.ktc4.pusan4.judgment.domain.Verdict;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** eval/cases/E-*.yaml 한 건. 형식은 eval/README.md. */
record EvalCase(
    String id,
    String group,
    boolean critical,
    boolean onHold,
    TransactionInput transaction,
    UserContext context,
    List<UserFact> facts,
    Expectation expected
) {

    record Expectation(
        Verdict verdict,
        boolean gateSpecified,
        Gate gate,
        List<String> citationsIncluded,
        List<String> citationsExcluded,
        Boolean inference,
        Map<String, Object> attributes
    ) {
    }

    private static final ObjectMapper MAPPER = new ObjectMapper(new YAMLFactory());
    private static final Set<String> GROUPS = Set.of("G1", "G2", "G3", "G4", "G5", "G6", "엣지");

    static EvalCase read(Path file, Set<String> categories) throws IOException {
        JsonNode root = MAPPER.readTree(file.toFile());
        Parser p = new Parser(file.getFileName().toString());

        String id = p.text(root, "id");
        String group = p.oneOf(p.text(root, "관문"), GROUPS, "관문");
        p.text(root, "근거");

        JsonNode ctx = p.node(root, "사업자컨텍스트");
        JsonNode industry = p.node(ctx, "업종코드");
        if (!industry.isTextual()) {
            throw p.error("사업자컨텍스트.업종코드는 따옴표로 감싼 문자열이어야 한다");
        }
        JsonNode ratio = ctx.path("자택작업실_비율");
        UserContext context = new UserContext(
            industry.asText(),
            ctx.path("직원있음").asBoolean(false),
            ratio.isNumber() ? ratio.intValue() : null
        );

        JsonNode tx = p.node(root, "거래");
        String category = p.text(tx, "merchant_category");
        if (!categories.isEmpty() && !categories.contains(category)) {
            throw p.error("merchant_category '" + category + "'가 rules/categories.yaml 밖이다");
        }
        TransactionInput transaction = new TransactionInput(
            UUID.nameUUIDFromBytes(id.getBytes(StandardCharsets.UTF_8)),
            LocalDate.parse(p.text(tx, "일자")),
            p.text(tx, "가맹점"),
            category,
            p.node(tx, "금액").longValue()
        );

        List<UserFact> facts = new ArrayList<>();
        for (JsonNode answer : root.path("응답")) {
            String scope = switch (p.text(answer, "범위")) {
                case "transaction" -> "transaction:" + transaction.id();
                case "merchant" -> "merchant:" + transaction.merchantNorm();
                default -> throw p.error("응답.범위는 transaction 또는 merchant");
            };
            facts.add(new UserFact(scope, p.text(answer, "fact_type"), Map.of("value", p.text(answer, "값"))));
        }

        JsonNode exp = p.node(root, "기대");
        JsonNode gate = exp.get("걸린게이트");
        JsonNode inference = exp.get("is_inference");
        Expectation expected = new Expectation(
            p.verdict(p.text(exp, "판정")),
            gate != null,
            gate == null || gate.isNull() ? null : p.gate(gate.asText()),
            strings(exp.path("근거조문_포함")),
            strings(exp.path("근거조문_제외")),
            inference == null || inference.isNull() ? null : inference.asBoolean(),
            exp.path("속성").isObject()
                ? MAPPER.convertValue(exp.path("속성"), new TypeReference<Map<String, Object>>() { })
                : Map.of()
        );

        JsonNode scoring = root.path("채점");
        return new EvalCase(id, group, scoring.path("치명").asBoolean(false),
            scoring.path("보류").asBoolean(false),
            transaction, context, List.copyOf(facts), expected);
    }

    private static List<String> strings(JsonNode node) {
        List<String> values = new ArrayList<>();
        node.forEach(value -> values.add(value.asText()));
        return List.copyOf(values);
    }

    private record Parser(String file) {

        JsonNode node(JsonNode parent, String field) {
            JsonNode value = parent.get(field);
            if (value == null || value.isNull()) {
                throw error(field + " 필드가 없다");
            }
            return value;
        }

        String text(JsonNode parent, String field) {
            String value = node(parent, field).asText();
            if (value.isBlank()) {
                throw error(field + " 필드가 비어 있다");
            }
            return value;
        }

        String oneOf(String value, Set<String> allowed, String field) {
            if (!allowed.contains(value)) {
                throw error(field + " '" + value + "'는 " + allowed + " 중 하나여야 한다");
            }
            return value;
        }

        Verdict verdict(String value) {
            return switch (value) {
                case "가능" -> Verdict.AVAILABLE;
                case "불가" -> Verdict.UNAVAILABLE;
                case "확인필요" -> Verdict.NEEDS_REVIEW;
                default -> throw error("기대.판정 '" + value + "'는 가능/불가/확인필요 중 하나여야 한다");
            };
        }

        Gate gate(String value) {
            if (!value.equals("G1") && !value.equals("G2")) {
                throw error("기대.걸린게이트는 G1, G2, null 중 하나여야 한다");
            }
            return Gate.valueOf(value);
        }

        IllegalArgumentException error(String message) {
            return new IllegalArgumentException(file + ": " + message);
        }
    }
}
