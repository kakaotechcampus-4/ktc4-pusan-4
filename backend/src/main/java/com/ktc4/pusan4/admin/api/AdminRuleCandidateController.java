package com.ktc4.pusan4.admin.api;

import com.ktc4.pusan4.judgment.domain.RuleCandidateStatus;
import com.ktc4.pusan4.judgment.persistence.RuleCandidateReviewService;
import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.api.PageResponse;
import com.ktc4.pusan4.shared.auth.CurrentUser;
import com.ktc4.pusan4.user.domain.AppUser;
import com.ktc4.pusan4.user.persistence.AdminPolicy;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "admin", description = "관리자 — 규칙 후보 (api.md 3.15). 관리자가 아니면 403 FORBIDDEN")
@ApiResponse(responseCode = "403", description = "FORBIDDEN",
    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
@RestController
@RequestMapping("/admin/rule-candidates")
public class AdminRuleCandidateController {

    private final AdminPolicy adminPolicy;
    private final RuleCandidateReviewService reviewService;

    public AdminRuleCandidateController(AdminPolicy adminPolicy, RuleCandidateReviewService reviewService) {
        this.adminPolicy = adminPolicy;
        this.reviewService = reviewService;
    }

    @Operation(summary = "규칙 후보 목록", description = "정렬: createdAt DESC, id DESC. status 가 없으면 전체")
    @GetMapping
    public PageResponse<RuleCandidateResponse> list(
        CurrentUser currentUser,
        @RequestParam(required = false) RuleCandidateStatus status,
        @RequestParam(defaultValue = "0") @Min(0) int page,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
    ) {
        adminPolicy.requireAdmin(currentUser.id());
        return PageResponse.of(reviewService.list(status, page, size).map(RuleCandidateResponse::from));
    }

    @Operation(summary = "규칙 후보 승인", description = "대기·검토중·보류만 승인할 수 있다. 규칙 카드는 만들지 않는다")
    @ApiResponse(responseCode = "404", description = "RULE_CANDIDATE_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "409", description = "CONFLICT — 이미 승인·기각한 후보",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/{candidateId}/approve")
    public RuleCandidateResponse approve(CurrentUser currentUser, @PathVariable long candidateId) {
        return review(currentUser, candidateId, RuleCandidateStatus.APPROVED);
    }

    @Operation(summary = "규칙 후보 기각", description = "대기·검토중·보류만 기각할 수 있다")
    @ApiResponse(responseCode = "404", description = "RULE_CANDIDATE_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "409", description = "CONFLICT — 이미 승인·기각한 후보",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/{candidateId}/reject")
    public RuleCandidateResponse reject(CurrentUser currentUser, @PathVariable long candidateId) {
        return review(currentUser, candidateId, RuleCandidateStatus.REJECTED);
    }

    /** 검토한 사람으로 남길 값. 이메일이 없는 계정(카카오 로그인)은 사용자 id 를 남긴다. */
    private static String reviewer(AppUser admin) {
        return admin.email() != null ? admin.email() : admin.id().toString();
    }

    private RuleCandidateResponse review(CurrentUser currentUser, long candidateId, RuleCandidateStatus decision) {
        AppUser admin = adminPolicy.requireAdmin(currentUser.id());
        return RuleCandidateResponse.from(reviewService.review(candidateId, decision, reviewer(admin)));
    }
}
