package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.shared.api.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "judgments", description = "판정 결과 (api.md 3.7, 3.8)")
@RestController
@RequestMapping("/judgments")
public class JudgmentController {

    @Operation(summary = "판정 목록 및 revision 조회",
        description = "batchId·year 는 거래별 현재 Judgment, runId 는 그 Run 이 실제 생성한 Judgment, "
            + "transactionId + latestOnly=false 는 전체 revision 이력. 정렬: computedAt DESC, id DESC")
    @GetMapping
    public PageResponse<JudgmentResponse> list(
        @RequestParam(required = false) UUID transactionId,
        @RequestParam(required = false) UUID batchId,
        @RequestParam(required = false) Integer year,
        @RequestParam(required = false) Verdict verdict,
        @Parameter(description = "runId 와 함께 쓰지 않는다") @RequestParam(defaultValue = "true") boolean latestOnly,
        @RequestParam(required = false) UUID runId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        throw ApiException.notImplemented();
    }

    @Operation(summary = "판정 결과 요약", description = "batchId, year, runId 중 정확히 하나를 사용한다")
    @GetMapping("/summary")
    public JudgmentSummaryResponse summary(
        @RequestParam(required = false) UUID batchId,
        @RequestParam(required = false) Integer year,
        @RequestParam(required = false) UUID runId
    ) {
        throw ApiException.notImplemented();
    }

    @Operation(summary = "판정 상세")
    @GetMapping("/{judgmentId}")
    public JudgmentResponse detail(@PathVariable UUID judgmentId) {
        throw ApiException.notImplemented();
    }

    @Operation(summary = "사용자 판정 수정 (Override)",
        description = "기존 Judgment 는 보존하고 새 revision 을 만든다. 같은 거래의 기존 활성 Override 는 비활성화된다. "
            + "응답은 새 Judgment")
    @PostMapping("/{judgmentId}/override")
    public JudgmentResponse override(
        @PathVariable UUID judgmentId,
        @RequestBody OverrideJudgmentRequest request
    ) {
        throw ApiException.notImplemented();
    }
}
