package com.ktc4.pusan4.merchant.classify;

import com.ktc4.pusan4.merchant.MerchantClassification;
import com.ktc4.pusan4.merchant.normalize.NormalizeSpecLoader;
import com.ktc4.pusan4.merchant.normalize.T1Normalizer;
import com.ktc4.pusan4.merchant.pg.PgBlocklist;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** 레포의 실제 규칙 파일과 가짜 사전으로 단계 순서를 검사한다. DB 는 쓰지 않는다. */
class RuleBasedMerchantClassifierTest {

    private static final Path RULES = Path.of("..", "rules");
    private static final UUID USER = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID OTHER = UUID.fromString("00000000-0000-0000-0000-000000000002");

    private static T1Normalizer normalizer;
    private static PgBlocklist pg;
    private static KeywordRules keywords;

    private final List<MerchantClassification> dictionaryRows = new ArrayList<>();
    private final List<Collection<String>> lookups = new ArrayList<>();

    @BeforeAll
    static void loadRules() throws IOException {
        normalizer = new T1Normalizer(new NormalizeSpecLoader().load(RULES));
        pg = PgBlocklist.load(RULES);
        keywords = KeywordRules.load(RULES);
    }

    private MerchantClassifier classifier() {
        return new RuleBasedMerchantClassifier(normalizer, pg, keywords, (userId, patterns) -> {
            lookups.add(List.copyOf(patterns));
            return dictionaryRows.stream().filter(r -> patterns.contains(r.pattern())).toList();
        });
    }

    private void dictionary(UUID owner, String pattern, String category) {
        dictionaryRows.add(new MerchantClassification(owner, pattern, pattern, category,
                owner == null ? "수기" : "user", null, BigDecimal.ONE));
    }

    private ClassificationResult classify(String raw) {
        return classifier().classifyAll(USER, List.of(new ClassificationInput(raw, ""))).get(0);
    }

    @Test
    void PG_명의는_사전보다_먼저_차단되고_사전을_조회하지_않는다() {
        dictionary(USER, "KG이니시스|스마일카페", "카페");

        ClassificationResult r = classify("KG이니시스-스마일카페");

        assertThat(r.stage()).isEqualTo(ClassificationStage.PG);
        assertThat(r.merchantCategory()).isEqualTo("PG_미상");
        assertThat(r.hint()).contains("스마일카페");
        assertThat(lookups).isEmpty();
    }

    @Test
    void 개인_사전이_전역_사전보다_먼저다() {
        dictionary(null, "성진이네", "음식점");
        dictionary(USER, "성진이네", "사무용품");

        ClassificationResult r = classify("성진이네 본점");

        assertThat(r.stage()).isEqualTo(ClassificationStage.PERSONAL_DICT);
        assertThat(r.merchantCategory()).isEqualTo("사무용품");
    }

    @Test
    void 다른_사용자의_개인_사전은_쓰지_않는다() {
        dictionary(OTHER, "성진이네", "음식점");

        ClassificationResult r = classify("성진이네 본점");

        assertThat(r.stage()).isEqualTo(ClassificationStage.UNCLASSIFIED);
    }

    @Test
    void 전역_사전이_키워드룰보다_먼저다() {
        dictionary(null, "스타벅스", "음식점");

        ClassificationResult r = classify("스타벅스 부산대점");

        assertThat(r.stage()).isEqualTo(ClassificationStage.GLOBAL_DICT);
        assertThat(r.merchantCategory()).isEqualTo("음식점");
    }

    @Test
    void 사전에_없으면_키워드룰로_분류한다() {
        ClassificationResult r = classify("스타벅스코리아 서면점");

        assertThat(r.stage()).isEqualTo(ClassificationStage.KEYWORD);
        assertThat(r.merchantCategory()).isEqualTo("카페");
        assertThat(r.merchantNorm()).isEqualTo("스타벅스");
        assertThat(r.matchedRule()).isNotBlank();
    }

    @Test
    void 지점이_달라도_같은_normKey_로_개인_사전에_걸린다() {
        dictionary(USER, "성진이네", "음식점");

        List<ClassificationResult> results = classifier().classifyAll(USER, List.of(
                new ClassificationInput("성진이네 본점", ""),
                new ClassificationInput("성진이네 2호점", ""),
                new ClassificationInput("성진이네 부산대점", "")));

        assertThat(results).allSatisfy(r -> {
            assertThat(r.stage()).isEqualTo(ClassificationStage.PERSONAL_DICT);
            assertThat(r.merchantNorm()).isEqualTo("성진이네");
        });
    }

    @Test
    void uncertain_룰에만_걸리면_미분류로_두고_힌트를_남긴다() {
        ClassificationResult r = classify("RESEND.COM");

        assertThat(r.stage()).isEqualTo(ClassificationStage.UNCLASSIFIED);
        assertThat(r.merchantCategory()).isEqualTo(ClassificationResult.UNCLASSIFIED);
        assertThat(r.hint()).isNotBlank();
    }

    @Test
    void 아무데도_안_걸리면_미분류다() {
        ClassificationResult r = classify("성진이네 본점");

        assertThat(r.stage()).isEqualTo(ClassificationStage.UNCLASSIFIED);
        assertThat(r.merchantCategory()).isEqualTo("미분류");
        assertThat(r.merchantNorm()).isEqualTo("성진이네");
        assertThat(r.classified()).isFalse();
    }

    @Test
    void 빈_상호는_정규화하지_않고_미분류로_둔다() {
        ClassificationResult r = classifier().classifyAll(USER, List.of(new ClassificationInput(null, null))).get(0);

        assertThat(r.stage()).isEqualTo(ClassificationStage.UNCLASSIFIED);
        assertThat(r.merchantNorm()).isEmpty();
    }

    @Test
    void 결과는_입력과_같은_순서이고_사전은_중복_없이_한_번만_조회한다() {
        List<ClassificationResult> results = classifier().classifyAll(USER, List.of(
                new ClassificationInput("스타벅스 부산대점", ""),
                new ClassificationInput("KG이니시스-스마일카페", ""),
                new ClassificationInput("성진이네 본점", ""),
                new ClassificationInput("스타벅스코리아 서면점", "")));

        assertThat(results).extracting(ClassificationResult::stage).containsExactly(
                ClassificationStage.KEYWORD, ClassificationStage.PG,
                ClassificationStage.UNCLASSIFIED, ClassificationStage.KEYWORD);
        assertThat(lookups).hasSize(1);
        assertThat(lookups.get(0)).containsExactly("스타벅스", "성진이네");
    }

    @Test
    void 빈_목록이면_사전을_조회하지_않는다() {
        assertThat(classifier().classifyAll(USER, List.of())).isEmpty();
        assertThat(lookups).isEmpty();
    }
}
