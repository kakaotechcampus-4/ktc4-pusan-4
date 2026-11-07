package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.StatuteVersion;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class StatuteResponseTest {

    @ParameterizedTest(name = "{0} → {3}")
    @CsvSource({
        "소득세법-33-1-5, 소득세법, 법률, 소득세법 제33조 제1항 제5호",
        "소득세법-39, 소득세법, 법률, 소득세법 제39조",
        "소득세법-81의6-1, 소득세법, 법률, 소득세법 제81조의6 제1항",
        "소득세법시행령-208의2-1-1, 소득세법 시행령, 시행령, 소득세법 시행령 제208조의2 제1항 제1호",
        "소득세법시행령-55-1-2의2, 소득세법 시행령, 시행령, 소득세법 시행령 제55조 제1항 제2호의2",
        "소득세법시행규칙-27-1, 소득세법 시행규칙, 시행규칙, 소득세법 시행규칙 제27조 제1항",
    })
    void law_title_gets_article_paragraph_and_item_from_statute_id(
        String statuteId, String title, String hierarchy, String expected
    ) {
        assertThat(StatuteResponse.from(statute(statuteId, title, hierarchy, "https://www.law.go.kr/")).title())
            .isEqualTo(expected);
    }

    @Test
    void title_that_already_names_the_article_is_kept() {
        // parse.py 가 조·항까지 넣어 저장하게 바뀌어도 두 번 붙지 않는다
        StatuteVersion statute = statute("소득세법시행령-67-4", "소득세법 시행령 제67조 제4항", "시행령", "https://www.law.go.kr/");

        assertThat(StatuteResponse.from(statute).title()).isEqualTo("소득세법 시행령 제67조 제4항");
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource({
        "판례-228451, 대법원 2014두1234, 판례",
        "해석례-31234, 소득세법 해석, 해석례",
        "업무용승용차운행기록방법에관한고시#2104628-3, 업무용승용차 운행기록 방법에 관한 고시, 고시",
    })
    void non_law_title_is_kept(String statuteId, String title, String hierarchy) {
        assertThat(StatuteResponse.from(statute(statuteId, title, hierarchy, "https://www.law.go.kr/")).title())
            .isEqualTo(title);
    }

    @Test
    void branch_article_link_points_to_law_go_kr_article_form() {
        // parse.py 는 '제81의6조' 로 만들지만 국가법령정보 주소는 '제81조의6' 이다
        StatuteVersion statute = statute("소득세법-81의6-1", "소득세법", "법률",
            "https://www.law.go.kr/법령/소득세법/제81의6조");

        assertThat(StatuteResponse.from(statute).sourceUrl()).isEqualTo("https://www.law.go.kr/법령/소득세법/제81조의6");
    }

    @Test
    void plain_article_link_is_kept() {
        StatuteVersion statute = statute("소득세법-33-1-5", "소득세법", "법률", "https://www.law.go.kr/법령/소득세법/제33조");

        assertThat(StatuteResponse.from(statute).sourceUrl()).isEqualTo("https://www.law.go.kr/법령/소득세법/제33조");
    }

    private static StatuteVersion statute(String statuteId, String title, String hierarchy, String sourceUrl) {
        return new StatuteVersion(1, statuteId, title, hierarchy, LocalDate.parse("2026-01-01"), null, sourceUrl, "본문");
    }
}
