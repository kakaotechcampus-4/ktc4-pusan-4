package com.ktc4.pusan4.judgment.domain;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 같은 Batch·groupKey·factType·status 의 질문 묶음 (api.md 3.9 grouped=true).
 */
public record QuestionGroup(List<Question> questions) {

    /**
     * 그룹 순서는 건수가 많은 순, 같으면 금액이 큰 순, 그다음 그룹 첫 질문 id 순이다(#54). 첫 페이지에 효과가 큰 상호가 먼저 온다.
     * 그룹 안은 거래 순서(approvedAt, transactionId)다. 순서는 {@link #order} 가 정한다.
     */
    public static List<QuestionGroup> group(List<Question> questions) {
        Map<UUID, Question> byId = questions.stream()
            .collect(Collectors.toMap(Question::id, Function.identity()));
        return order(questions.stream().map(Member::of).toList()).stream()
            .map(members -> new QuestionGroup(members.stream().map(member -> byId.get(member.id())).toList()))
            .toList();
    }

    /**
     * 묶고 순서를 정하는 데 필요한 값만으로 그룹을 세운다. 목록 한 쪽의 그룹을 고를 때 질문마다 거래, 답, 수정 여부를
     * 붙이지 않으려고 쓴다. 순서는 {@link #group} 과 같다.
     */
    public static List<List<Member>> order(List<Member> members) {
        Map<List<Object>, List<Member>> groups = members.stream()
            .collect(Collectors.groupingBy(
                member -> List.of(member.batchId(), member.groupKey(), member.factType(), member.status()),
                LinkedHashMap::new, Collectors.toList()));
        return groups.values().stream()
            .map(group -> group.stream()
                .sorted(Comparator.comparing(Member::approvedAt).thenComparing(Member::transactionId))
                .toList())
            .sorted(Comparator.comparingInt((List<Member> group) -> group.size()).reversed()
                .thenComparing(Comparator.comparingLong(QuestionGroup::amountOf).reversed())
                .thenComparing(group -> group.getFirst().id()))
            .toList();
    }

    private static long amountOf(List<Member> group) {
        return group.stream().mapToLong(Member::amount).sum();
    }

    /** 묶기와 순서에 쓰는 질문 값. amount 는 질문이 걸린 거래의 금액이다. */
    public record Member(UUID id, UUID batchId, String groupKey, String factType, QuestionStatus status,
                         UUID transactionId, LocalDate approvedAt, long amount) {

        static Member of(Question question) {
            return new Member(question.id(), question.batchId(), question.groupKey(), question.factType(),
                question.status(), question.transactionId(), question.transaction().approvedAt(),
                question.transaction().amount());
        }
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
