package com.ktc4.pusan4.judgment.rule;

import com.ktc4.pusan4.judgment.domain.Citation;
import com.ktc4.pusan4.judgment.domain.Gate;
import com.ktc4.pusan4.judgment.domain.RuleCard;
import com.ktc4.pusan4.judgment.domain.RuleSet;
import com.ktc4.pusan4.judgment.domain.Verdict;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProfileCardGeneratorTest {

    private static final Path REPO_RULES = Path.of("..", "rules");
    private static final Path REPO_PROFILES = Path.of("..", "profiles");

    @TempDir
    Path root;

    @Test
    void 통상_칸은_템플릿으로_업종별_카드를_만든다() throws IOException {
        writeTemplate("R-102_교육.yaml", EDUCATION_TEMPLATE);
        writeProfile("940909", 1, "교육: 통상");

        RuleCard card = loadGenerated().get(Gate.G2).getFirst();

        assertThat(card.id()).isEqualTo("R-940909102");
        assertThat(card.version()).isEqualTo(101);
        assertThat(card.match().industries()).containsExactly("940909");
        assertThat(card.match().categories()).containsExactly("교육");
        assertThat(card.verdict()).isEqualTo(Verdict.AVAILABLE);
        assertThat(card.account()).isEqualTo("교육훈련비");
        assertThat(card.citations()).containsExactly(
            new Citation("소득세법-27-1"), new Citation("소득세법시행령-55-1-28"));
    }

    // 조건부·비통상은 무엇을 물을지 사람이 업종을 보고 설계한다. 생성기는 만들지 않는다.
    @Test
    void 조건부와_비통상_칸은_카드를_만들지_않는다() throws IOException {
        writeTemplate("R-102_교육.yaml", EDUCATION_TEMPLATE);
        writeProfile("940909", 1, "교육: 조건부");
        writeProfile("940100", 1, "교육: 비통상");

        assertThat(generate()).isEmpty();
    }

    // 새 업종이 통상이라고 한 칸에 템플릿이 없으면, 그 카드를 사람이 먼저 템플릿으로 써야 한다.
    @Test
    void 통상_칸에_템플릿이_없으면_생성을_거부한다() throws IOException {
        writeTemplate("R-102_교육.yaml", EDUCATION_TEMPLATE);
        writeProfile("940909", 1, "도서: 통상");

        assertThatThrownBy(this::generate)
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("도서")
            .hasMessageContaining("940909");
    }

    @Test
    void 템플릿의_판정은_가능이어야_한다() throws IOException {
        writeTemplate("R-102_교육.yaml", EDUCATION_TEMPLATE.replace("verdict: 가능", "verdict: 확인필요"));
        writeProfile("940909", 1, "교육: 통상");

        assertThatThrownBy(this::generate)
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("R-102")
            .hasMessageContaining("가능");
    }

    // version 이 없으면 0 으로 읽혀 카드 version 이 프로파일 version 만 남는다.
    @Test
    void 템플릿에_version이_없으면_생성을_거부한다() throws IOException {
        writeTemplate("R-102_교육.yaml", EDUCATION_TEMPLATE.replace("version: 1\n", ""));
        writeProfile("940909", 1, "교육: 통상");

        assertThatThrownBy(this::generate)
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("R-102")
            .hasMessageContaining("version");
    }

    @Test
    void 템플릿_ID는_세_자리_번호여야_한다() throws IOException {
        writeTemplate("R-1020_교육.yaml", EDUCATION_TEMPLATE.replace("id: R-102", "id: R-1020"));
        writeProfile("940909", 1, "교육: 통상");

        assertThatThrownBy(this::generate)
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("R-1020_교육.yaml");
    }

    // 업종은 생성기가 프로파일에서 채운다.
    @Test
    void 템플릿은_업종을_정하지_않는다() throws IOException {
        writeTemplate("R-102_교육.yaml", EDUCATION_TEMPLATE.replace(
            "  category: [교육]", "  category: [교육]\n  industry: [\"940909\"]"));
        writeProfile("940909", 1, "교육: 통상");

        assertThatThrownBy(this::generate)
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("match.industry");
    }

    @Test
    void 템플릿은_카테고리를_하나만_가진다() throws IOException {
        writeTemplate("R-102_교육.yaml", EDUCATION_TEMPLATE.replace("category: [교육]", "category: [교육, 도서]"));
        writeProfile("940909", 1, "교육: 통상");

        assertThatThrownBy(this::generate)
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("match.category");
    }

    @Test
    void 같은_카테고리의_템플릿은_하나뿐이다() throws IOException {
        writeTemplate("R-102_교육.yaml", EDUCATION_TEMPLATE);
        writeTemplate("R-103_교육.yaml", EDUCATION_TEMPLATE.replace("id: R-102", "id: R-103"));
        writeProfile("940909", 1, "교육: 통상");

        assertThatThrownBy(this::generate)
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("same category");
    }

    @Test
    void 프로파일_업종_코드는_여섯_자리다() throws IOException {
        writeTemplate("R-102_교육.yaml", EDUCATION_TEMPLATE);
        writeProfile("94090", 1, "교육: 통상");

        assertThatThrownBy(this::generate)
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("industry_code");
    }

    // 프로파일 version 은 카드 version 의 끝 두 자리다.
    @Test
    void 프로파일_version은_1부터_99까지다() throws IOException {
        writeTemplate("R-102_교육.yaml", EDUCATION_TEMPLATE);
        writeProfile("940909", 100, "교육: 통상");

        assertThatThrownBy(this::generate)
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("version");
    }

    @Test
    void 업종마다_ID와_파일_이름이_따로_생긴다() throws IOException {
        writeTemplate("R-102_교육.yaml", EDUCATION_TEMPLATE);
        writeProfile("940909", 1, "교육: 통상");
        writeProfile("940100", 3, "교육: 통상");

        Map<String, String> generated = generate();

        assertThat(generated).containsOnlyKeys("R-940100102_교육.yaml", "R-940909102_교육.yaml");
        assertThat(generated.get("R-940100102_교육.yaml")).contains("version: 103");
    }

    // 템플릿이나 프로파일을 고치고 다시 만들지 않으면 여기서 막힌다. 백엔드 CI 는 rules/·profiles/ 변경에도 돈다.
    @Test
    void 저장된_생성_카드는_템플릿과_프로파일로_다시_만든_결과와_같다() throws IOException {
        Map<String, String> expected = ProfileCardGenerator.generate(REPO_RULES.resolve("templates"), REPO_PROFILES);

        Map<String, String> stored = new TreeMap<>();
        for (Path file : ProfileCardGenerator.generatedFiles(REPO_RULES.resolve("cards"))) {
            stored.put(file.getFileName().toString(), Files.readString(file).replace("\r\n", "\n"));
        }

        assertThat(stored)
            .as("rules/cards 의 생성 카드가 낡았다. ./backend/gradlew -p backend generateRuleCards 로 다시 만든다")
            .isEqualTo(expected);
    }

    // 조건부·비통상 칸은 사람이 쓴 카드가 맡는다. 카드가 없으면 질문 없이 확인필요(RULE_NOT_FOUND)로
    // 떨어지고, 조건부인데 카드가 가능·불가로 확정하면 프로파일과 카드가 어긋난 것이다.
    @Test
    void 조건부와_비통상_칸마다_사람이_쓴_카드가_있다() throws IOException {
        RuleSet rules = new RuleCardLoader().load(REPO_RULES);

        for (ProfileCardGenerator.Profile profile : ProfileCardGenerator.profiles(REPO_PROFILES)) {
            profile.cells().forEach((category, value) -> {
                if (value.equals(ProfileCardGenerator.ORDINARY)) {
                    return;
                }
                List<RuleCard> cards = rules.get(Gate.G2).stream()
                    .filter(card -> !card.match().holiday()
                        && card.match().categories().equals(List.of(category))
                        && card.match().industries().contains(profile.industryCode()))
                    .toList();
                String cell = "profiles/%s.yaml %s=%s".formatted(profile.industryCode(), category, value);
                assertThat(cards).as(cell + " 를 맡는 카드").isNotEmpty();
                if (value.equals("조건부")) {
                    assertThat(cards).as(cell).allSatisfy(card ->
                        assertThat(card.verdict()).as(card.id()).isEqualTo(Verdict.NEEDS_REVIEW));
                }
            });
        }
    }

    private static final String EDUCATION_TEMPLATE = """
        # 사람이 쓰는 주석은 템플릿에만 남는다
        id: R-102
        version: 1
        gate: G2
        priority: 500
        effective_period: { start: 2024-01-01, end: null }
        match:
          category: [교육]
        verdict: 가능
        account: 교육훈련비
        citations:
          - { id: 소득세법-27-1, verified: true }
          - { id: 소득세법시행령-55-1-28, verified: true }
        review: { by: 미검수, date: 2026-09-14 }
        """;

    private Map<String, String> generate() throws IOException {
        return ProfileCardGenerator.generate(root.resolve("rules/templates"), root.resolve("profiles"));
    }

    private void writeTemplate(String fileName, String content) throws IOException {
        Files.createDirectories(root.resolve("rules/templates"));
        Files.writeString(root.resolve("rules/templates").resolve(fileName), content);
    }

    private void writeProfile(String industryCode, int version, String... cells) throws IOException {
        Files.createDirectories(root.resolve("profiles"));
        Files.writeString(root.resolve("profiles").resolve(industryCode + ".yaml"), """
            industry_code: "%s"
            version: %d
            통상성:
              %s
            """.formatted(industryCode, version, String.join("\n  ", cells)));
    }

    private RuleSet loadGenerated() throws IOException {
        Path cards = Files.createDirectories(root.resolve("rules/cards"));
        for (Map.Entry<String, String> file : generate().entrySet()) {
            Files.writeString(cards.resolve(file.getKey()), file.getValue());
        }
        return new RuleCardLoader().load(root.resolve("rules"));
    }
}
