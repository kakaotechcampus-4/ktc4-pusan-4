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
    @Schema(description = "파서가 확인 필요로 표시한 이유. G0(입력 검증)에서 멈춘 확인 필요일 때만 값이 있다",
        example = "같은 상호·금액 취소가 63일 떨어져 있음 — 62일 밖이라 상계하지 않음") String reviewReason,
    OffsetDateTime computedAt,
    List<CitationResponse> citations
) {

    /** explanation 은 출처(RuleCard reason)가 아직 없어 비워 둔다. */
    static JudgmentResponse from(JudgmentRevision judgment, RuleSet rules) {
        JudgedTransaction transaction = judgment.transaction();
        return new JudgmentResponse(judgment.id(), judgment.transactionId(),
            new TransactionSummary(transaction.approvedAt(), transaction.merchantRaw(), transaction.merchantNorm(),
                transaction.merchantCategory(), transaction.amount(), transaction.installmentMonths()),
            judgment.revision(), judgment.origin(), verdict(judgment.verdict()), judgment.blockedAtGate(),
            judgment.outOfScope(), judgment.account(), rules.accountLabel(judgment.account()), judgment.finalAmount(), judgment.inference(),
            judgment.unmatchedReason(), judgment.attributes(), judgment.ruleCardId(), judgment.ruleCardVersion(),
            judgment.appliedRuleIds(), judgment.rulesCommitSha(), judgment.userContextVersion(),
            /* explanation */ null, reviewReason(judgment), judgment.computedAt(),
            judgment.citations().stream()
                .map(citation -> new CitationResponse(citation.statuteVersionId(), citation.statuteId()))
                .toList());
    }

    /**
     * G0 에서 멈춘 확인 필요만 파서 사유를 보인다. 카드로 정해진 판정(G0 전에 저장된 것)이나,
     * blockedAtGate 를 이어받는 사용자 수정 revision 에 붙이면 판정과 이유가 어긋난다.
     */
    private static String reviewReason(JudgmentRevision judgment) {
        return judgment.blockedAtGate() == Gate.G0 && judgment.verdict() == Verdict.NEEDS_REVIEW
            ? judgment.transaction().reviewReason()
            : null;
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
