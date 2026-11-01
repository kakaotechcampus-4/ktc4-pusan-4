package com.ktc4.pusan4.judgment.domain;

import com.ktc4.pusan4.judgment.domain.JudgmentRevision.JudgedTransaction;
import com.ktc4.pusan4.judgment.domain.PreviousAnswerSuggestion.History;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class PreviousAnswerSuggesterTest {

    private static final Map<String, PreviousAnswer> TIERS = Map.of(
        "TELECOM", PreviousAnswer.CARRY, "CAFE", PreviousAnswer.HISTORY);
    private static final UUID AUGUST = UUID.randomUUID();
    private static final UUID SEPTEMBER = UUID.randomUUID();

    @Test
    void carry_offers_the_latest_answer_of_the_most_recent_upload() {
        List<PreviousAnswerSuggestion> suggestions = suggest(telecomGroup(), List.of(
            past("TELECOM", "merchant:SKT", "전용", AnswerSource.USER, AUGUST, 8, 1),
            past("TELECOM", "merchant:SKT", "전용", AnswerSource.USER, SEPTEMBER, 9, 1)));

        assertThat(suggestions.getFirst())
            .extracting(PreviousAnswerSuggestion::tier, PreviousAnswerSuggestion::value,
                PreviousAnswerSuggestion::sourceLabel, PreviousAnswerSuggestion::fillable)
            .containsExactly("A", "전용", "9월 업로드(국민)", true);
    }

    @Test
    void carry_uses_the_last_version_of_each_upload_and_flags_a_conflict_between_the_last_two_uploads() {
        List<PreviousAnswerSuggestion> suggestions = suggest(telecomGroup(), List.of(
            past("TELECOM", "merchant:SKT", "개인", AnswerSource.USER, AUGUST, 8, 1),
            past("TELECOM", "merchant:SKT", "공용", AnswerSource.USER, AUGUST, 8, 2),
            past("TELECOM", "merchant:SKT", "전용", AnswerSource.USER, SEPTEMBER, 9, 1)));

        PreviousAnswerSuggestion suggestion = suggestions.getFirst();
        assertThat(suggestion.value()).isNull();
        assertThat(suggestion.conflict()).isTrue();
        assertThat(suggestion.history()).containsExactly(
            new History("전용", "9월 업로드(국민)", false), new History("공용", "8월 업로드(국민)", false));
        assertThat(suggestion.fillable()).isFalse();
    }

    @Test
    void carry_shows_a_bulk_answer_only_as_history() {
        List<PreviousAnswerSuggestion> suggestions = suggest(telecomGroup(), List.of(
            past("TELECOM", "merchant:SKT", "전용", AnswerSource.BULK, SEPTEMBER, 9, 1)));

        assertThat(suggestions.getFirst().value()).isNull();
        assertThat(suggestions.getFirst().history()).containsExactly(new History("전용", "9월 업로드(국민)", true));
    }

    @Test
    void carry_ignores_an_upload_whose_answer_is_not_an_option_any_more() {
        List<PreviousAnswerSuggestion> suggestions = suggest(telecomGroup(), List.of(
            past("TELECOM", "merchant:SKT", "전용", AnswerSource.USER, AUGUST, 8, 1),
            past("TELECOM", "merchant:SKT", "옛 선택지", AnswerSource.USER, SEPTEMBER, 9, 1),
            past("TELECOM", "merchant:LGU", "개인", AnswerSource.USER, SEPTEMBER, 9, 1)));

        assertThat(suggestions.getFirst())
            .extracting(PreviousAnswerSuggestion::value, PreviousAnswerSuggestion::sourceLabel)
            .containsExactly("전용", "8월 업로드(국민)");
    }

    @Test
    void history_counts_answers_of_the_same_merchant_without_choosing_one() {
        QuestionGroup cafe = group("transaction:t1", "용도", "CAFE", List.of("업무미팅", "개인"), "스타벅스", false);

        List<PreviousAnswerSuggestion> suggestions = suggest(cafe, List.of(
            past("CAFE", "transaction:a", "업무미팅", AnswerSource.USER, AUGUST, 8, 1, "스타벅스"),
            past("CAFE", "transaction:b", "업무미팅", AnswerSource.USER, SEPTEMBER, 9, 1, "스타벅스"),
            past("CAFE", "transaction:c", "개인", AnswerSource.USER, SEPTEMBER, 9, 1, "스타벅스"),
            past("CAFE", "transaction:d", "업무미팅", AnswerSource.USER, SEPTEMBER, 9, 1, "이디야")));

        assertThat(suggestions.getFirst())
            .extracting(PreviousAnswerSuggestion::tier, PreviousAnswerSuggestion::value,
                PreviousAnswerSuggestion::historyCounts)
            .containsExactly("B", null, Map.of("업무미팅", 2, "개인", 1));
    }

    @Test
    void awaiting_explanation_and_cards_without_a_tier_are_not_shown() {
        QuestionGroup weekend = group("transaction:t1", "용도", "CAFE", List.of("업무미팅", "개인"), "스타벅스", true);
        QuestionGroup shopping = group("transaction:t2", "용도", "SHOPPING", List.of("업무용", "개인"), "쿠팡", false);

        List<PreviousAnswerSuggestion> suggestions = PreviousAnswerSuggester.suggest(List.of(weekend, shopping),
            code -> TIERS.getOrDefault(code, PreviousAnswer.NONE),
            List.of(past("CAFE", "transaction:a", "업무미팅", AnswerSource.USER, AUGUST, 8, 1, "스타벅스")));

        assertThat(suggestions).extracting(PreviousAnswerSuggestion::tier, PreviousAnswerSuggestion::reason)
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple("C", "소명 대기 질문은 건마다 답해야 합니다"),
                org.assertj.core.groups.Tuple.tuple("C", "건마다 따로 답하는 질문입니다"));
    }

    @Test
    void source_label_names_the_months_of_the_upload() {
        assertThat(PastAnswer.sourceLabel(LocalDate.of(2025, 9, 1), LocalDate.of(2025, 9, 30), "국민"))
            .isEqualTo("9월 업로드(국민)");
        assertThat(PastAnswer.sourceLabel(LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31), "신한"))
            .isEqualTo("1~12월 업로드(신한)");
        assertThat(PastAnswer.sourceLabel(LocalDate.of(2024, 12, 1), LocalDate.of(2025, 1, 31), "국민"))
            .isEqualTo("2024.12~2025.1 업로드(국민)");
    }

    private static List<PreviousAnswerSuggestion> suggest(QuestionGroup group, List<PastAnswer> past) {
        return PreviousAnswerSuggester.suggest(List.of(group), code -> TIERS.getOrDefault(code, PreviousAnswer.NONE),
            past);
    }

    private static QuestionGroup telecomGroup() {
        return group("merchant:SKT", "전용여부", "TELECOM", List.of("전용", "공용", "개인"), "SKT", false);
    }

    private static QuestionGroup group(String groupKey, String factType, String code, List<String> options,
        String merchantNorm, boolean awaitingExplanation) {
        return new QuestionGroup(List.of(new Question(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
            groupKey, factType, "질문", options, QuestionStatus.PENDING, null, null,
            OffsetDateTime.parse("2025-10-09T10:00:00+09:00"), null,
            new JudgedTransaction(LocalDate.of(2025, 10, 8), merchantNorm, merchantNorm, "통신", 10_000, 0),
            false, awaitingExplanation, code)));
    }

    private static PastAnswer past(String code, String groupKey, String value, AnswerSource source, UUID batchId,
        int month, int version) {
        return past(code, groupKey, value, source, batchId, month, version, "SKT");
    }

    private static PastAnswer past(String code, String groupKey, String value, AnswerSource source, UUID batchId,
        int month, int version, String merchantNorm) {
        LocalDate start = LocalDate.of(2025, month, 1);
        return new PastAnswer(code, groupKey, merchantNorm, value, source, batchId, start,
            start.withDayOfMonth(start.lengthOfMonth()), "국민", version);
    }
}
