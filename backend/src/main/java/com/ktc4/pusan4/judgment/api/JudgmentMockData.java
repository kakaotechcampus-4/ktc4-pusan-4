package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.Gate;
import com.ktc4.pusan4.judgment.domain.JudgmentOrigin;
import com.ktc4.pusan4.judgment.domain.JudgmentOriginType;
import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.shared.api.Coded;
import com.ktc4.pusan4.transaction.api.TransactionSummary;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.ktc4.pusan4.shared.api.MockFixtures.BATCH_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.FACT_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.OVERRIDE_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.OVERRIDE_JUDGMENT_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.QUESTION_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.TRANSACTION_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.singlePage;

/**
 * 서비스 레이어가 붙기 전까지 judgment-runs·judgments·questions API 가 반환하는 고정 응답.
 *
 * <p>스타벅스 거래 하나가 용도 질문을 기다리는(NEEDS_REVIEW) 장면을 보여 준다.
 */
@Component
public class JudgmentMockData {

    private static final String RULES_COMMIT_SHA = "0000000000000000000000000000000000000000";
    private static final List<CitationResponse> CITATIONS = List.of(new CitationResponse(1418, "소득세법-27-1"));
    private static final String PURPOSE_QUESTION = "이 가맹점에서 쓴 비용은 주로 어떤 목적이었나요?";
    private static final List<String> PURPOSE_OPTIONS = List.of("사업", "개인", "혼용");
    private static final Unresolved UNRESOLVED = new Unresolved(1, 12_800L);
    /** TransactionMockData 의 스타벅스 거래와 같은 값 */
    private static final TransactionSummary STARBUCKS = new TransactionSummary(LocalDate.parse("2026-01-12"),
        "스타벅스코리아 서면점", "스타벅스", "카페", 12_800L, 0);

    /**
     * 스타벅스 거래 첫 판정(NEEDS_REVIEW)의 다음 revision. Override 는 verdict 만 바꾸고 나머지는 원본에서 이어받는다
     * (api.md 3.8).
     */
    public JudgmentResponse override() {
        return starbucksRevision(OVERRIDE_JUDGMENT_ID, 2, new JudgmentOrigin(JudgmentOriginType.OVERRIDE, OVERRIDE_ID),
            new Coded<>(Verdict.UNAVAILABLE, "불가"),
            "사용자가 판정을 수정했습니다.",
            OffsetDateTime.parse("2026-09-12T14:10:00+09:00"));
    }

    /**
     * 스타벅스 거래(R-300 카페 카드)의 판정 revision. revision 마다 달라지는 값만 인자로 받는다.
     */
    private JudgmentResponse starbucksRevision(
        UUID id, int revision, JudgmentOrigin origin, Coded<Verdict> verdict, String explanation,
        OffsetDateTime computedAt
    ) {
        return new JudgmentResponse(id, TRANSACTION_ID, STARBUCKS, revision, origin, verdict,
            Gate.G2,
            /* outOfScope */ false,
            /* account */ "소모품비",
            /* finalAmount */ null,
            /* isInference */ false,
            /* unmatchedReason */ null,
            /* attributes */ Map.of(),
            /* ruleCardId */ "R-300",
            /* ruleCardVersion */ 1,
            /* appliedRuleIds */ List.of("R-300"),
            RULES_COMMIT_SHA,
            /* userContextVersion */ 1,
            explanation, computedAt, CITATIONS);
    }

    public QuestionPage questions() {
        QuestionResponse question = new QuestionResponse(QUESTION_ID, BATCH_ID, TRANSACTION_ID,
            "merchant:스타벅스", "용도", PURPOSE_QUESTION, PURPOSE_OPTIONS,
            new Coded<>(QuestionStatus.PENDING, "대기"), null, /* answer */ null,
            OffsetDateTime.parse("2026-09-12T14:05:30+09:00"), null);
        return new QuestionPage(List.of(question), UNRESOLVED, singlePage(1));
    }

    public QuestionGroupPage questionGroups() {
        QuestionGroupResponse.QuestionTransaction transaction = new QuestionGroupResponse.QuestionTransaction(
            QUESTION_ID, TRANSACTION_ID, STARBUCKS.approvedAt(), STARBUCKS.merchantRaw(), STARBUCKS.merchantNorm(),
            STARBUCKS.merchantCategory(), STARBUCKS.amount(), STARBUCKS.installmentMonths(), /* overridden */ false);
        QuestionGroupResponse group = new QuestionGroupResponse("merchant:스타벅스", "용도",
            new Coded<>(QuestionStatus.PENDING, "대기"), List.of(QUESTION_ID), 1, 12_800L, PURPOSE_QUESTION,
            PURPOSE_OPTIONS, /* answer */ null, /* bulkAnswerable */ true, List.of(transaction));
        return new QuestionGroupPage(List.of(group), UNRESOLVED, singlePage(1));
    }

    public QuestionAnswerResponse answer() {
        return new QuestionAnswerResponse(1, FACT_ID, 1);
    }

    public BulkAnswerResponse bulkAnswer() {
        return new BulkAnswerResponse(1, 0, /* excludedCount */ 0, List.of(FACT_ID), 1, new Unresolved(0, 0L));
    }
}
