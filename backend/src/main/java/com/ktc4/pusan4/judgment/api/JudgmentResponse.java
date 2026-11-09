package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.Gate;
import com.ktc4.pusan4.judgment.domain.JudgmentOrigin;
import com.ktc4.pusan4.judgment.domain.JudgmentRevision;
import com.ktc4.pusan4.judgment.domain.RuleSet;
import com.ktc4.pusan4.judgment.domain.JudgmentRevision.JudgedTransaction;
import com.ktc4.pusan4.judgment.domain.UnmatchedReason;
import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.shared.api.Coded;
import com.ktc4.pusan4.transaction.api.TransactionSummary;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record JudgmentResponse(
    UUID id,
    UUID transactionId,
    @Schema(description = "판정한 거래의 요약. 목록 화면이 거래를 따로 조회하지 않게 붙인다") TransactionSummary transaction,
    @Schema(description = "Transaction 재판정마다 증가") int revision,
    JudgmentOrigin origin,
    Coded<Verdict> verdict,
    @Schema(description = "답변 대기. 불가인데 이 거래에 답하지 않은 질문이 남았다. 판정이 아니라 불가에 붙는 표지다 (api.md 2.1)")
    boolean awaitingAnswer,
    @Schema(description = "차단된 경우에만 값이 있다") Gate blockedAtGate,
    @Schema(description = "범위 밖 핸드오프. true 면 판정하지 않고 세무사에게 넘긴 건이다. "
        + "verdict 는 항상 NEEDS_REVIEW 이고, 되묻기 대기와 달리 답할 질문이 없다 (docs/rule-card-fields.md)")
    boolean outOfScope,
    @Schema(description = "계정과목 ID. 분기·비교는 이 값으로 한다(rules/accounts.yaml)", example = "접대비") String account,
    @Schema(description = "계정과목 화면 이름. 화면·내보내기는 이 값을 보인다", example = "기업업무추진비") String accountLabel,
    @Schema(description = "안분·상각 적용 후 인정 금액. G6 한도는 연간 집계라 넣지 않는다(year 요약과 limits 가 반영)")
    Long finalAmount,
    @Schema(description = "룰로 확정하지 못한 fallback 결과인지") Boolean isInference,
    UnmatchedReason unmatchedReason,
    @Schema(description = "판정 과정에서 생성된 속성") Map<String, Object> attributes,
    @Schema(description = "대표 적용 RuleCard", example = "R-310") String ruleCardId,
    Integer ruleCardVersion,
    List<String> appliedRuleIds,
    String rulesCommitSha,
    @Schema(description = "판정에 사용된 Context 버전") Integer userContextVersion,
    @Schema(description = "판정 설명. 값의 출처는 api.md 확정 후 반영") String explanation,
    OffsetDateTime computedAt,
    List<CitationResponse> citations
) {

    /** explanation 은 출처(RuleCard reason)가 아직 없어 비워 둔다. */
    static JudgmentResponse from(JudgmentRevision judgment, RuleSet rules, boolean pendingQuestion) {
        JudgedTransaction transaction = judgment.transaction();
        return new JudgmentResponse(judgment.id(), judgment.transactionId(),
            new TransactionSummary(transaction.approvedAt(), transaction.merchantRaw(), transaction.merchantNorm(),
                transaction.merchantCategory(), transaction.amount(), transaction.installmentMonths()),
            judgment.revision(), judgment.origin(), verdict(judgment.verdict()),
            judgment.verdict() == Verdict.UNAVAILABLE && pendingQuestion, judgment.blockedAtGate(),
            judgment.outOfScope(), judgment.account(), rules.accountLabel(judgment.account()), judgment.finalAmount(), judgment.inference(),
            judgment.unmatchedReason(), judgment.attributes(), judgment.ruleCardId(), judgment.ruleCardVersion(),
            judgment.appliedRuleIds(), judgment.rulesCommitSha(), judgment.userContextVersion(),
            /* explanation */ null, judgment.computedAt(),
            judgment.citations().stream()
                .map(citation -> new CitationResponse(citation.statuteVersionId(), citation.statuteId()))
                .toList());
    }

    /** 화면 문구는 api.md 2.1 을 따른다. */
    static Coded<Verdict> verdict(Verdict verdict) {
        String label = switch (verdict) {
            case AVAILABLE -> "가능";
            case UNAVAILABLE -> "불가";
            case NEEDS_REVIEW -> "확인 필요";
        };
        return new Coded<>(verdict, label);
    }
}
