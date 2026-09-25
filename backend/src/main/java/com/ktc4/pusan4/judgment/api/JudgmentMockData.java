package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.api.JudgmentSummaryResponse.AccountSummary;
import com.ktc4.pusan4.judgment.api.JudgmentSummaryResponse.Scope;
import com.ktc4.pusan4.judgment.api.JudgmentSummaryResponse.VerdictSummary;
import com.ktc4.pusan4.judgment.domain.Gate;
import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.shared.api.Coded;
import com.ktc4.pusan4.shared.api.PageResponse;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.ktc4.pusan4.shared.api.MockFixtures.BATCH_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.CONTEXT_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.FACT_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.JUDGMENT_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.OVERRIDE_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.OVERRIDE_JUDGMENT_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.QUESTION_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.RUN_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.TRANSACTION_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.page;
import static com.ktc4.pusan4.shared.api.MockFixtures.singlePage;

/**
 * 서비스 레이어가 붙기 전까지 judgment-runs·judgments·questions·statutes API 가 반환하는 고정 응답.
 *
 * <p>스타벅스 거래 하나가 용도 질문을 기다리는(NEEDS_REVIEW) 장면을 보여 준다.
 */
@Component
public class JudgmentMockData {

    private static final int TOTAL_COUNT = 23;
    private static final OffsetDateTime RUN_STARTED_AT = OffsetDateTime.parse("2026-09-12T14:01:00+09:00");
    private static final OffsetDateTime RUN_COMPLETED_AT = OffsetDateTime.parse("2026-09-12T14:05:00+09:00");
    private static final String RULES_COMMIT_SHA = "0000000000000000000000000000000000000000";
    private static final List<CitationResponse> CITATIONS = List.of(new CitationResponse(1418, "소득세법-27-1"));
    private static final String PURPOSE_QUESTION = "이 가맹점에서 쓴 비용은 주로 어떤 목적이었나요?";
    private static final List<String> PURPOSE_OPTIONS = List.of("사업", "개인", "혼용");
    private static final Unresolved UNRESOLVED = new Unresolved(1, 12_800L);

    public JudgmentRunCreatedResponse createRun() {
        return new JudgmentRunCreatedResponse(RUN_ID, BATCH_ID, CONTEXT_ID, 1,
            new Coded<>(JudgmentRunStatus.QUEUED, "대기"), TOTAL_COUNT);
    }

    public JudgmentRunResponse run() {
        return new JudgmentRunResponse(RUN_ID, BATCH_ID, CONTEXT_ID, 1,
            new Coded<>(JudgmentRunStatus.COMPLETED, "완료"), TOTAL_COUNT, TOTAL_COUNT, 0,
            RUN_STARTED_AT, RUN_COMPLETED_AT);
    }

    public PageResponse<JudgmentRunFailureResponse> runFailures() {
        return page(List.of());
    }

    public PageResponse<JudgmentResponse> judgments() {
        return page(List.of(judgment()));
    }

    public JudgmentSummaryResponse summary() {
        Map<Verdict, VerdictSummary> byVerdict = new EnumMap<>(Verdict.class);
        byVerdict.put(Verdict.AVAILABLE, new VerdictSummary(11, 1_530_066L));
        byVerdict.put(Verdict.UNAVAILABLE, new VerdictSummary(6, 0L));
        byVerdict.put(Verdict.NEEDS_REVIEW, new VerdictSummary(6, 0L));
        return new JudgmentSummaryResponse(new Scope("BATCH", BATCH_ID.toString()), TOTAL_COUNT, byVerdict,
            List.of(new AccountSummary("지급수수료", 3, 178_800L)));
    }

    public JudgmentResponse judgment() {
        return starbucksRevision(JUDGMENT_ID, 1, new JudgmentOrigin(JudgmentOriginType.RUN, RUN_ID),
            new Coded<>(Verdict.NEEDS_REVIEW, "확인 필요"),
            "1인 사업자의 단독 카페 이용은 세무 실무에서도 판단이 갈리는 항목입니다. "
                + "지출 목적이 확인되지 않아 단정하지 않고 확인 필요로 고정합니다.",
            RUN_COMPLETED_AT);
    }

    /**
     * {@link #judgment()} 의 다음 revision. Override 는 verdict 만 바꾸고 나머지는 원본에서 이어받는다 (api.md 3.8).
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
        return new JudgmentResponse(id, TRANSACTION_ID, revision, origin, verdict,
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
            new Coded<>(QuestionStatus.PENDING, "대기"), null,
            OffsetDateTime.parse("2026-09-12T14:05:30+09:00"), null);
        return new QuestionPage(List.of(question), UNRESOLVED, singlePage(1));
    }

    public QuestionGroupPage questionGroups() {
        QuestionGroupResponse group = new QuestionGroupResponse("merchant:스타벅스", "용도", List.of(QUESTION_ID), 1,
            12_800L, PURPOSE_QUESTION, PURPOSE_OPTIONS);
        return new QuestionGroupPage(List.of(group), UNRESOLVED, singlePage(1));
    }

    public QuestionAnswerResponse answer() {
        return new QuestionAnswerResponse(1, FACT_ID, 1);
    }

    public BulkAnswerResponse bulkAnswer() {
        return new BulkAnswerResponse(1, 0, List.of(FACT_ID), 1, new Unresolved(0, 0L));
    }

    public StatuteResponse statute() {
        return new StatuteResponse(1418, "소득세법-27-1", "소득세법 제27조 제1항", "법률",
            LocalDate.parse("2025-01-01"), null, "https://www.law.go.kr/",
            "거주자의 각 소득에 대한 총수입금액을 계산할 때 필요경비에 산입할 금액은 해당 과세기간에 "
                + "총수입금액에 대응하는 비용으로서 일반적으로 용인되는 통상적인 것의 합계액으로 한다.");
    }
}
