package com.ktc4.pusan4.judgment.domain;

import com.ktc4.pusan4.judgment.domain.PreviousAnswerSuggestion.History;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 지난번 답 불러오기의 등급 계산 (agent-secretary.md 3.1, api.md 3.14). DB 없이 단위 테스트한다(QR-11).
 * 다른 업로드의 답은 읽기만 하고, 적용은 질문 응답 API 로 한다.
 */
public final class PreviousAnswerSuggester {

    static final String AWAITING_EXPLANATION = "소명 대기 질문은 건마다 답해야 합니다";
    static final String ANSWER_EACH = "건마다 따로 답하는 질문입니다";

    // 기간이 늦은 업로드부터 본다. 같으면 시작이 늦은 쪽, 그다음 id 로 순서를 고정한다.
    private static final Comparator<PastAnswer> RECENT_FIRST = Comparator
        .comparing(PastAnswer::periodEnd).reversed()
        .thenComparing(Comparator.comparing(PastAnswer::periodStart).reversed())
        .thenComparing(PastAnswer::batchId);

    private PreviousAnswerSuggester() {
    }

    /**
     * @param pendingGroups 이 업로드의 PENDING 질문 그룹
     * @param tierOf        질문 코드의 등급(카드 previous_answer)
     * @param past          같은 사용자의 다른 업로드에서 답한 질문
     */
    public static List<PreviousAnswerSuggestion> suggest(
        List<QuestionGroup> pendingGroups, Function<String, PreviousAnswer> tierOf, List<PastAnswer> past
    ) {
        return pendingGroups.stream().map(group -> suggest(group, tierOf, past)).toList();
    }

    private static PreviousAnswerSuggestion suggest(
        QuestionGroup group, Function<String, PreviousAnswer> tierOf, List<PastAnswer> past
    ) {
        String code = group.questions().getFirst().code();
        // 소명 대기는 지난 답으로 풀면 안 된다. 일괄 응답에서 뺀 이유(#103)와 같다.
        if (!group.bulkAnswerable()) {
            return hidden(group, code, AWAITING_EXPLANATION);
        }
        return switch (tierOf.apply(code)) {
            case CARRY -> carry(group, code, past);
            case HISTORY -> history(group, code, past);
            case NONE -> hidden(group, code, ANSWER_EACH);
        };
    }

    private static PreviousAnswerSuggestion carry(QuestionGroup group, String code, List<PastAnswer> past) {
        List<String> options = group.questions().getFirst().options();
        // 업로드마다 마지막 답 하나. 지금 선택지에 없으면 그 업로드는 답이 없는 것으로 본다.
        List<PastAnswer> latestPerUpload = past.stream()
            .filter(answer -> answer.code().equals(code) && answer.groupKey().equals(group.groupKey()))
            .collect(Collectors.toMap(PastAnswer::batchId, Function.identity(),
                (left, right) -> left.version() >= right.version() ? left : right))
            .values().stream()
            .filter(answer -> options.contains(answer.value()))
            .sorted(RECENT_FIRST)
            .toList();
        String tier = PreviousAnswer.CARRY.tier();
        if (latestPerUpload.isEmpty()) {
            return new PreviousAnswerSuggestion(group.groupKey(), group.factType(), code, tier, null, null, null, null,
                null, null, group.count());
        }
        PastAnswer latest = latestPerUpload.getFirst();
        if (latest.source() == AnswerSource.BULK) {
            return new PreviousAnswerSuggestion(group.groupKey(), group.factType(), code, tier, null, null, null,
                List.of(history(latest)), null, null, group.count());
        }
        if (latestPerUpload.size() > 1 && !latest.value().equals(latestPerUpload.get(1).value())) {
            return new PreviousAnswerSuggestion(group.groupKey(), group.factType(), code, tier, null, null, true,
                List.of(history(latest), history(latestPerUpload.get(1))), null, null, group.count());
        }
        return new PreviousAnswerSuggestion(group.groupKey(), group.factType(), code, tier, latest.value(),
            latest.sourceLabel(), null, null, null, null, group.count());
    }

    /** 건별 질문은 묶음 키가 거래라 업로드를 넘어 같아지지 않는다. 같은 가맹점의 답을 센다. */
    private static PreviousAnswerSuggestion history(QuestionGroup group, String code, List<PastAnswer> past) {
        List<String> options = group.questions().getFirst().options();
        String merchantNorm = group.questions().getFirst().transaction().merchantNorm();
        Map<String, Long> counted = past.stream()
            .filter(answer -> answer.code().equals(code) && answer.merchantNorm().equals(merchantNorm))
            .filter(answer -> options.contains(answer.value()))
            .collect(Collectors.groupingBy(PastAnswer::value, Collectors.counting()));
        Map<String, Integer> counts = new LinkedHashMap<>();
        counted.entrySet().stream()
            .sorted(Map.Entry.<String, Long>comparingByValue().reversed()
                .thenComparing(entry -> options.indexOf(entry.getKey())))
            .forEach(entry -> counts.put(entry.getKey(), entry.getValue().intValue()));
        return new PreviousAnswerSuggestion(group.groupKey(), group.factType(), code, PreviousAnswer.HISTORY.tier(),
            null, null, null, null, counts.isEmpty() ? null : counts, null, group.count());
    }

    private static PreviousAnswerSuggestion hidden(QuestionGroup group, String code, String reason) {
        return new PreviousAnswerSuggestion(group.groupKey(), group.factType(), code, PreviousAnswer.NONE.tier(),
            null, null, null, null, null, reason, group.count());
    }

    private static History history(PastAnswer answer) {
        return new History(answer.value(), answer.sourceLabel(), answer.source() == AnswerSource.BULK);
    }
}
