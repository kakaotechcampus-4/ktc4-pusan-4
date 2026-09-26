package com.ktc4.pusan4.judgment.rule;

import com.ktc4.pusan4.judgment.domain.Citation;
import com.ktc4.pusan4.judgment.domain.Gate;
import com.ktc4.pusan4.judgment.domain.Judgment;
import com.ktc4.pusan4.judgment.domain.JudgmentEngine;
import com.ktc4.pusan4.judgment.domain.RuleCard;
import com.ktc4.pusan4.judgment.domain.RuleSet;
import com.ktc4.pusan4.judgment.domain.TransactionInput;
import com.ktc4.pusan4.judgment.domain.UnmatchedReason;
import com.ktc4.pusan4.judgment.domain.UserContext;
import com.ktc4.pusan4.judgment.domain.UserFact;
import com.ktc4.pusan4.judgment.domain.Verdict;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 레포의 실물 규칙 카드({@code rules/cards/})를 읽는다.
 *
 * <p>{@link RuleCardLoaderTest}는 @TempDir 에 만든 카드만 읽어서, 실물 카드가 깨져도
 * 아무도 모른다. 이 테스트가 그 구멍을 막는다 — 로딩이 곧 스키마 검증이고
 * (priority 401 미만, effective_period 누락, G1 verdict 누락, 차단 카드 충돌은
 * 전부 로딩 시점에 예외다), {@code tools/validate_rules.py} 는 이것들을 보지 않는다.
 */
class RuleCardLoaderRealCardsTest {

    // 테스트 작업 디렉터리는 Gradle 프로젝트 디렉터리(backend/)다.
    private static final Path RULES = Path.of("..", "rules");

    private static final UserContext 인적용역 = new UserContext("940909", false, null);

    private RuleSet load() throws IOException {
        assertThat(RULES.resolve("cards"))
            .as("실물 카드 디렉터리 (작업 디렉터리: %s)", Path.of("").toAbsolutePath())
            .isDirectory();
        return new RuleCardLoader().load(RULES);
    }

    private static TransactionInput 거래(String 상호, String 카테고리, long 금액) {
        return new TransactionInput(
            UUID.randomUUID(), LocalDate.of(2025, 3, 14), 상호, 카테고리, 금액);
    }

    private static List<String> 인용조문(Judgment judgment) {
        return judgment.citations().stream().map(Citation::statuteId).toList();
    }

    @Test
    void 실물_카드가_전부_로딩된다() throws IOException {
        RuleSet rules = load();

        assertThat(rules.get(Gate.G1))
            .extracting(RuleCard::id)
            .contains("R-001", "R-002", "R-003", "R-004", "R-005", "R-007");
    }

    @Test
    void G1_카드는_전부_불가이고_근거를_가진다() throws IOException {
        assertThat(load().get(Gate.G1)).allSatisfy(card -> {
            assertThat(card.verdict()).isEqualTo(Verdict.UNAVAILABLE);
            assertThat(card.citations()).isNotEmpty();
        });
    }

    @Test
    void 주차위반_과태료는_12호가_아니라_2호를_인용한다() throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            거래("서울특별시 주정차위반과태료", "지자체_과태료", 40_000), 인적용역, List.of(), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.UNAVAILABLE);
        assertThat(judgment.blockedAtGate()).isEqualTo(Gate.G1);
        assertThat(judgment.appliedRuleIds()).containsExactly("R-004");
        assertThat(인용조문(judgment))
            .containsExactly("소득세법-33-1-2")
            .doesNotContain("소득세법-33-1-12");
    }

    @Test
    void 지방소득세는_1호로_차단된다() throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            거래("서울시청 지방소득세", "조세", 250_000), 인적용역, List.of(), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.UNAVAILABLE);
        assertThat(judgment.appliedRuleIds()).containsExactly("R-001");
        assertThat(인용조문(judgment)).containsExactly("소득세법-33-1-1");
    }

    @Test
    void 차량은_불가가_아니라_확인필요다() throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            거래("GS칼텍스 역삼주유소", "차량", 80_000), 인적용역, List.of(), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.NEEDS_REVIEW);
        assertThat(judgment.appliedRuleIds()).contains("R-070");
        assertThat(인용조문(judgment))
            .contains("소득세법-33의2", "업무용승용차운행기록방법에관한고시#2104628-3")
            .doesNotContain("업무용승용차운행기록방법에관한고시#52390-3");
    }

    /**
     * 리뷰어 지적의 본질. 범위 밖 핸드오프와 되묻기 대기는 둘 다 확인필요라 출력이 같은데
     * 할 말은 정반대다 — 전자는 "세무사에게 넘겼습니다", 후자는 "답해주세요". out_of_scope
     * 가 그 구분을 싣는다. 이게 깨지면 화면이 다시 둘을 한 문구로 뭉갠다.
     */
    @Test
    void 범위밖_핸드오프는_되묻기_대기와_구분된다() throws IOException {
        RuleSet rules = load();

        Judgment 차량 = JudgmentEngine.judge(
            거래("GS칼텍스 역삼주유소", "차량", 80_000), 인적용역, List.of(), rules);
        Judgment 용역비 = JudgmentEngine.judge(
            거래("용역비 이체", "PG_미상", 500_000), 인적용역, List.of(), rules);
        Judgment 되묻기 = JudgmentEngine.judge(
            거래("NETFLIX", "구독서비스", 17_000), 인적용역, List.of(), rules);

        assertThat(차량.verdict()).isEqualTo(Verdict.NEEDS_REVIEW);
        assertThat(차량.outOfScope()).isTrue();
        assertThat(용역비.appliedRuleIds()).contains("R-071");
        assertThat(용역비.outOfScope()).isTrue();

        // 판정이 같아도 사유가 다르다. 이 거래는 답을 받으면 확정된다.
        assertThat(되묻기.verdict()).isEqualTo(Verdict.NEEDS_REVIEW);
        assertThat(되묻기.outOfScope()).isFalse();
        assertThat(되묻기.questions()).isNotEmpty();
    }

    /**
     * 자산 되묻기는 판정이 아니라 당해 경비 '금액'을 바꾼다. 답을 듣기 전에 가능으로
     * 확정하면 사용자가 전액 경비로 읽는데, 실제로는 상각액뿐이라 금액 과대계상이 된다.
     * 증빙 되묻기와 갈리는 지점이다 — 그쪽은 가산세만 세우므로 강등하지 않는다.
     * 평가셋 E-055 가 이 경계를 치명으로 잡는다.
     */
    @Test
    void 금액을_바꾸는_자산_되묻기는_판정을_확정하지_않는다() throws IOException {
        RuleSet rules = load();

        Judgment 비품 = JudgmentEngine.judge(
            거래("오피스디포 문서세단기", "사무용품", 1_000_001), 인적용역, List.of(), rules);
        Judgment 증빙만 = JudgmentEngine.judge(
            거래("AMAZON WEB SERVICES", "해외SaaS", 50_000), 인적용역, List.of(), rules);

        assertThat(비품.verdict()).isEqualTo(Verdict.NEEDS_REVIEW);
        assertThat(비품.questions()).isNotEmpty();

        // 가산세 플래그만 세우는 질문은 앞 관문의 확정을 끌어내리지 않는다.
        assertThat(증빙만.verdict()).isEqualTo(Verdict.AVAILABLE);
        assertThat(증빙만.questions()).isNotEmpty();
    }

    /** 범위 밖은 판정과 축이 다르다. 불가로 확정된 건이 동시에 핸드오프일 수는 없다. */
    @Test
    void 불가_확정에는_범위밖이_붙지_않는다() throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            거래("서울시 주정차위반 과태료", "지자체_과태료", 40_000), 인적용역, List.of(), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.UNAVAILABLE);
        assertThat(judgment.outOfScope()).isFalse();
    }

    @Test
    void 해외SaaS는_가능이고_지급수수료로_배정된다() throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            거래("AMAZON WEB SERVICES", "해외SaaS", 50_000), 인적용역, List.of(), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.AVAILABLE);
        assertThat(judgment.account()).isEqualTo("지급수수료");
        assertThat(judgment.appliedRuleIds()).contains("R-100");
        assertThat(인용조문(judgment)).contains("소득세법-27-1");
    }

    /**
     * `증빙필요` 는 amount_min 만으로 정해지므로 R-060 의 카드 attributes 에 있다.
     * 되묻기 effect 로 내리면 답변 전까지 화면에 뜨지 않는다.
     */
    @Test
    void 증빙필요는_답변_전에도_속성으로_실린다() throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            거래("AMAZON WEB SERVICES", "해외SaaS", 50_000), 인적용역, List.of(), load());

        assertThat(judgment.attributes()).containsEntry("증빙필요", true);
        assertThat(judgment.attributes()).doesNotContainKey("가산세_대상");
    }

    /**
     * 답변 전에는 확정하지 않는다. 근거는 비우지 않고 양쪽(§27① 가능 / §33①5 불가)을
     * 함께 싣는다 — 로더가 확정 verdict 선택지에 근거를 요구하는데, 엔진이 답변 전에도
     * 카드 citations 를 그대로 싣기 때문이다. 한쪽만 실으면 판정하지 않은 결론으로 읽힌다.
     */
    @Test
    void 구독서비스는_확인필요이고_전용여부를_되묻는다() throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            거래("NETFLIX.COM", "구독서비스", 15_000), 인적용역, List.of(), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.NEEDS_REVIEW);
        assertThat(judgment.appliedRuleIds()).containsExactly("R-101");
        assertThat(judgment.questions()).singleElement().satisfies(question -> {
            assertThat(question.factType()).isEqualTo("전용여부");
            assertThat(question.groupBy()).isEqualTo("merchant:NETFLIX.COM");
            assertThat(question.options()).containsExactly("업무 전용", "개인 전용", "업무·개인 혼용");
        });
        assertThat(인용조문(judgment)).containsExactly("소득세법-27-1", "소득세법-33-1-5");
    }

    /** 되묻기 응답이 카드 기본 판정을 대체한다. */
    @Test
    void 구독서비스_개인전용_응답이면_불가로_확정된다() throws IOException {
        UserFact 응답 = new UserFact(
            "merchant:NETFLIX.COM", "전용여부", Map.of("value", "개인 전용"));

        Judgment judgment = JudgmentEngine.judge(
            거래("NETFLIX.COM", "구독서비스", 15_000), 인적용역, List.of(응답), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.UNAVAILABLE);
        assertThat(judgment.questions()).isEmpty();
        assertThat(judgment.account()).isNull();
    }

    /** 업무 전용 응답은 가능 + 계정과목까지 확정한다. */
    @Test
    void 구독서비스_업무전용_응답이면_가능으로_확정된다() throws IOException {
        UserFact 응답 = new UserFact(
            "merchant:NETFLIX.COM", "전용여부", Map.of("value", "업무 전용"));

        Judgment judgment = JudgmentEngine.judge(
            거래("NETFLIX.COM", "구독서비스", 15_000), 인적용역, List.of(응답), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.AVAILABLE);
        assertThat(judgment.account()).isEqualTo("지급수수료");
    }

    /**
     * (b) 카드는 match.industry 로 940909 에 고정돼 있다. 다른 업종이 들어오면
     * 매칭에 실패해 확인필요로 떨어져야 한다 — 프로파일이 없는 업종의 안전 기본값이다.
     */
    @Test
    void 다른_업종코드는_업종참조_카드에_매칭되지_않는다() throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            거래("AMAZON WEB SERVICES", "해외SaaS", 50_000),
            new UserContext("722000", false, null), List.of(), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.NEEDS_REVIEW);
        assertThat(judgment.unmatchedReason()).isEqualTo(UnmatchedReason.RULE_NOT_FOUND);
        assertThat(judgment.inference()).isTrue();
        assertThat(judgment.citations()).isEmpty();
    }

    @Test
    void 불가_판정에는_계정과목을_비운다() throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            거래("서울특별시 주정차위반과태료", "지자체_과태료", 40_000), 인적용역, List.of(), load());

        assertThat(judgment.account()).isNull();
    }
    /**
     * keyword 는 merchant_raw 부분일치다. 맨 '건강보험'을 쓰면 민간 보험사 상호가
     * 그대로 걸려, 근거 조문(국민건강보험법·노인장기요양보험법만 규정)이 닿지 않는
     * 지출을 가능으로 확정한다. R-106 의 priority 510 이라 아무도 바로잡지 못한다.
     */
    @Test
    void 민간보험사_건강보험료는_공단_카드에_걸리지_않는다() throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            거래("메리츠화재 건강보험료 자동이체", "금융", 50_000), 인적용역, List.of(), load());

        assertThat(judgment.verdict()).isNotEqualTo(Verdict.AVAILABLE);
        assertThat(judgment.account()).isNull();
        assertThat(judgment.appliedRuleIds()).doesNotContain("R-106");
    }

    @Test
    void 공단_건강보험료는_여전히_가능이다() throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            거래("국민건강보험공단", "금융", 180_000), 인적용역, List.of(), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.AVAILABLE);
        assertThat(judgment.account()).isEqualTo("보험료");
        assertThat(인용조문(judgment)).contains("소득세법시행령-55-1-11의3");
    }

    /**
     * §33①4 는 징수의무를 '불이행해서' 대신 낸 세액이다. 정상 납부까지 G1 이
     * 잡으면 불가로 확정되고 G2 의 범위 밖 핸드오프(R-071)에 도달하지 못한다.
     */
    @Test
    void 정상_원천세_납부는_G1이_차단하지_않고_범위밖으로_간다() throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            거래("3월분 급여원천세 납부", "기타", 300_000), 인적용역, List.of(), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.NEEDS_REVIEW);
        assertThat(judgment.appliedRuleIds()).contains("R-071").doesNotContain("R-003");
        assertThat(인용조문(judgment)).contains("소득세법-127-1-3");
    }

    @Test
    void 원천징수_불이행은_여전히_G1_불가다() throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            거래("원천징수불이행 미납세액", "기타", 300_000), 인적용역, List.of(), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.UNAVAILABLE);
        assertThat(인용조문(judgment)).containsExactly("소득세법-33-1-4");
    }

    /** PG_미상은 실체를 모르므로 사업 관련성을 직접 되묻는다. */
    @Test
    void PG미상은_용도를_되묻는다() throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            거래("나이스정보통신", "PG_미상", 15_000), 인적용역, List.of(), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.NEEDS_REVIEW);
        assertThat(judgment.questions()).singleElement()
            .satisfies(question -> assertThat(question.code()).isEqualTo("PG_UNKNOWN_PURPOSE"));
    }

    /**
     * 주말 식대는 개인 식사로 추정해 불가지만, 소명할 수 있게 용도 질문을 남긴다
     * (세무사 실무 질의응답 2026-09 Q2: 소명이 없으면 개인 식사비로 추정).
     * 주말 카드가 평일 카드보다 priority 가 높아 이기는지도 함께 본다.
     */
    @ParameterizedTest
    @ValueSource(strings = {"음식점", "카페", "음식배달"})
    void 주말_식대는_불가로_추정하되_소명_질문을_남긴다(String 카테고리) throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            주말거래(카테고리), 인적용역, List.of(), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.UNAVAILABLE);
        assertThat(judgment.questions()).singleElement()
            .satisfies(question -> assertThat(question.factType()).isEqualTo("용도"));
        assertThat(judgment.attributes()).containsEntry("주말결제", true);
    }

    /** 소명한 주말 식대는 평일과 같은 결과여야 한다. 주말이라 더 불리하거나 유리하지 않다. */
    @Test
    void 주말_업무미팅_소명은_평일과_같은_결과다() throws IOException {
        TransactionInput 토요일 = 주말거래("음식점");
        TransactionInput 금요일 = 거래("한식당", "음식점", 25_000);

        Judgment 주말 = JudgmentEngine.judge(토요일, 인적용역, List.of(업무미팅(토요일)), load());
        Judgment 평일 = JudgmentEngine.judge(금요일, 인적용역, List.of(업무미팅(금요일)), load());

        assertThat(주말.verdict()).isEqualTo(평일.verdict());
        assertThat(주말.account()).isEqualTo(평일.account());
        assertThat(주말.attributes()).containsEntry("limit_bucket", 평일.attributes().get("limit_bucket"));
        assertThat(주말.questions()).isEmpty();
    }

    /**
     * 로더는 모르는 match 키를 조용히 무시한다. 주말 카드에 weekday 를 weekdays 처럼 오타 내면
     * 요일 조건이 사라져 평일 식대까지 전부 불가가 되는데, 그걸 잡는 건 이 테스트뿐이다.
     */
    @ParameterizedTest
    @ValueSource(strings = {"음식점", "카페", "음식배달"})
    void 평일_식대는_기존_카드가_판정한다(String 카테고리) throws IOException {
        Judgment judgment = JudgmentEngine.judge(
            거래("가맹점", 카테고리, 25_000), 인적용역, List.of(), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.NEEDS_REVIEW);
        assertThat(judgment.attributes()).doesNotContainKey("주말결제");
    }

    private static TransactionInput 주말거래(String 카테고리) {
        return new TransactionInput(UUID.randomUUID(), LocalDate.of(2025, 3, 15), "가맹점", 카테고리, 25_000);
    }

    private static UserFact 업무미팅(TransactionInput 거래) {
        return new UserFact("transaction:" + 거래.id(), "용도", Map.of("value", "업무미팅"));
    }

    /** 무엇을 샀는지는 여전히 모르므로 가능이어도 계정과목은 비운다. */
    @Test
    void PG미상_업무용_응답은_가능이되_계정과목을_비운다() throws IOException {
        TransactionInput 거래 = 거래("나이스정보통신", "PG_미상", 15_000);
        UserFact 응답 = new UserFact(
            "transaction:" + 거래.id(), "용도", Map.of("value", "업무용"));

        Judgment judgment = JudgmentEngine.judge(거래, 인적용역, List.of(응답), load());

        assertThat(judgment.verdict()).isEqualTo(Verdict.AVAILABLE);
        assertThat(judgment.account()).isNull();
        assertThat(judgment.questions()).isEmpty();
    }
}
