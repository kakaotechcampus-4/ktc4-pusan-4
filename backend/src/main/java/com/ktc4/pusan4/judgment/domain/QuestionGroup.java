package com.ktc4.pusan4.judgment.domain;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 같은 Batch·groupKey·factType·status 의 질문 묶음 (api.md 3.9 grouped=true).
 */
public record QuestionGroup(List<Question> questions) {

    /**
     * 그룹 순서는 건수가 많은 순, 같으면 금액이 큰 순, 그다음 그룹 첫 질문 id 순이다(#54). 첫 페이지에 효과가 큰 상호가 먼저 온다.
     * 그룹 안은 거래 순서(approvedAt, transactionId)다.
     */
    public static List<QuestionGroup> group(List<Question> questions) {
        Map<List<Object>, List<Question>> groups = questions.stream()
            .collect(Collectors.groupingBy(
                question -> List.of(question.batchId(), question.groupKey(), question.factType(), question.status()),
                LinkedHashMap::new, Collectors.toList()));
        return groups.values().stream()
            .map(members -> new QuestionGroup(members.stream()
                .sorted(Comparator.comparing((Question question) -> question.transaction().approvedAt())
                    .thenComparing(Question::transactionId))
                .toList()))
            .sorted(Comparator.comparingInt(QuestionGroup::count).reversed()
                .thenComparing(Comparator.comparingLong(QuestionGroup::totalAmount).reversed())
                .thenComparing(group -> group.questions().getFirst().id()))
            .toList();
    }

    public String groupKey() {
        return questions.getFirst().groupKey();
    }

    public String factType() {
        return questions.getFirst().factType();
    }

    public QuestionStatus status() {
        return questions.getFirst().status();
    }

    public List<UUID> questionIds() {
        return questions.stream().map(Question::id).toList();
    }

    public int count() {
        return questions.size();
    }

    /** 답변·정정은 그룹의 질문을 모두 같은 UserFact 로 바꾸므로 그룹 안에서 답이 갈리지 않는다. */
    public String answer() {
        return questions.getFirst().answer();
    }

    /** 일괄 응답(api.md 3.11) 대상인지. 소명 대기 거래의 질문이 하나라도 있으면 아니다. */
    public boolean bulkAnswerable() {
        return status() == QuestionStatus.PENDING
            && questions.stream().noneMatch(Question::awaitingExplanation);
    }

    public long totalAmount() {
        return questions.stream().mapToLong(question -> question.transaction().amount()).sum();
    }
}
