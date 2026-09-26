package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.Gate;
import com.ktc4.pusan4.judgment.domain.UnmatchedReason;
import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.shared.api.Coded;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record JudgmentResponse(
    UUID id,
    UUID transactionId,
    @Schema(description = "Transaction 재판정마다 증가") int revision,
    JudgmentOrigin origin,
    Coded<Verdict> verdict,
    @Schema(description = "차단된 경우에만 값이 있다") Gate blockedAtGate,
    @Schema(description = "범위 밖 핸드오프. true 면 판정하지 않고 세무사에게 넘긴 건이다. "
        + "verdict 는 항상 NEEDS_REVIEW 이고, 되묻기 대기와 달리 답할 질문이 없다 (docs/rule-card-fields.md)")
    boolean outOfScope,
    @Schema(description = "계정과목", example = "소모품비") String account,
    @Schema(description = "안분·상각·한도 적용 후 인정 금액") Long finalAmount,
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
}
