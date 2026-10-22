package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.api.JudgmentSummaryResponse.Scope;
import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.judgment.persistence.JudgmentListQuery;
import com.ktc4.pusan4.judgment.persistence.JudgmentOverrideService;
import com.ktc4.pusan4.judgment.persistence.JudgmentQueryService;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.api.PageResponse;
import com.ktc4.pusan4.shared.auth.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;

@Tag(name = "judgments", description = "판정 결과 (api.md 3.7, 3.8)")
@RestController
@RequestMapping("/judgments")
public class JudgmentController {

    private final JudgmentQueryService queryService;
    private final JudgmentOverrideService overrideService;

    public JudgmentController(JudgmentQueryService queryService, JudgmentOverrideService overrideService) {
        this.queryService = queryService;
        this.overrideService = overrideService;
    }

    @Operation(summary = "판정 목록 및 revision 조회",
        description = "batchId·year 는 거래별 현재 Judgment, runId 는 그 Run 이 실제 생성한 Judgment, "
            + "transactionId + latestOnly=false 는 전체 revision 이력. 조건은 모두 AND. "
            + "정렬: computedAt DESC, id DESC")
    @GetMapping
    public PageResponse<JudgmentResponse> list(
        CurrentUser currentUser,
        @RequestParam(required = false) UUID transactionId,
        @RequestParam(required = false) UUID batchId,
        @RequestParam(required = false) Integer year,
        @RequestParam(required = false) Verdict verdict,
        @Parameter(description = "runId 와 함께 쓰지 않는다") @RequestParam(defaultValue = "true") boolean latestOnly,
        @RequestParam(required = false) UUID runId,
        @RequestParam(defaultValue = "0") @Min(0) int page,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
    ) {
        JudgmentListQuery query = new JudgmentListQuery(transactionId, batchId, year, verdict, latestOnly, runId);
        return PageResponse.of(queryService.list(currentUser.id(), query, page, size).map(JudgmentResponse::from));
    }

    @Operation(summary = "판정 결과 요약",
        description = "batchId, year, runId 중 정확히 하나를 사용한다. batchId·year 는 현재 판정, runId 는 그 Run 이 만든 판정")
    @ApiResponse(responseCode = "400", description = "INVALID_SUMMARY_SCOPE — batchId, year, runId 가 0개거나 2개 이상",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @GetMapping("/summary")
    public JudgmentSummaryResponse summary(
        CurrentUser currentUser,
        @RequestParam(required = false) UUID batchId,
        @RequestParam(required = false) Integer year,
        @RequestParam(required = false) UUID runId
    ) {
        long scopes = Stream.of(batchId, year, runId).filter(Objects::nonNull).count();
        if (scopes != 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SUMMARY_SCOPE",
                "batchId, year, runId 중 정확히 하나를 지정해야 합니다.");
        }
        return JudgmentSummaryResponse.from(scope(batchId, year, runId),
            queryService.summary(currentUser.id(), batchId, year, runId));
    }

    private static Scope scope(UUID batchId, Integer year, UUID runId) {
        if (batchId != null) {
            return new Scope("BATCH", batchId.toString());
        }
        if (year != null) {
            return new Scope("YEAR", year.toString());
        }
        return new Scope("RUN", runId.toString());
    }

    @Operation(summary = "판정 상세", description = "현재 판정이 아닌 이전 revision 도 조회할 수 있다")
    @ApiResponse(responseCode = "404", description = "JUDGMENT_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @GetMapping("/{judgmentId}")
    public JudgmentResponse detail(CurrentUser currentUser, @PathVariable UUID judgmentId) {
        return JudgmentResponse.from(queryService.get(currentUser.id(), judgmentId));
    }

    @Operation(summary = "사용자 판정 수정 (Override)",
        description = "기존 Judgment 는 보존하고 verdict 만 바꾼 새 revision 을 만든다. 같은 거래의 기존 활성 Override 는 "
            + "비활성화된다. 응답은 새 Judgment")
    @ApiResponse(responseCode = "404", description = "JUDGMENT_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "409", description = "CONFLICT — 거래의 현재 판정이 아니거나 판정 대상이 아닌 거래",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "422", description = "UNPROCESSABLE_ENTITY — toVerdict 가 NEEDS_REVIEW",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/{judgmentId}/override")
    public JudgmentResponse override(
        CurrentUser currentUser,
        @PathVariable UUID judgmentId,
        @Valid @RequestBody OverrideJudgmentRequest request
    ) {
        UUID revisionId = overrideService.override(currentUser.id(), judgmentId, request.toVerdict(), request.reason());
        // 저장 트랜잭션이 끝난 뒤 다시 읽어야 DB 가 정한 computedAt 이 실린다.
        return JudgmentResponse.from(queryService.get(currentUser.id(), revisionId));
    }
}
