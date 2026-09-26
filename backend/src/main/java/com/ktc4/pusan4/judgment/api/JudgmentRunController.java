package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.api.MockResponse;
import com.ktc4.pusan4.shared.api.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "judgment-runs", description = "판정 실행 (api.md 3.6). 진행 상황은 GET 폴링으로 확인한다")
@RestController
@RequestMapping("/judgment-runs")
public class JudgmentRunController {

    private final JudgmentMockData mockData;

    public JudgmentRunController(JudgmentMockData mockData) {
        this.mockData = mockData;
    }

    @MockResponse
    @Operation(summary = "Batch 전체 판정 실행",
        description = "같은 Batch 에 여러 번 실행할 수 있고, 다시 판정하면 새 revision 을 만든다")
    @ApiResponse(responseCode = "404", description = "BATCH_NOT_FOUND, CONTEXT_NOT_FOUND(문진 전)",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public JudgmentRunCreatedResponse create(@RequestBody CreateJudgmentRunRequest request) {
        return mockData.createRun();
    }

    @MockResponse
    @Operation(summary = "판정 실행 상태 조회")
    @ApiResponse(responseCode = "404", description = "JUDGMENT_RUN_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @GetMapping("/{runId}")
    public JudgmentRunResponse detail(@PathVariable UUID runId) {
        return mockData.run();
    }

    @MockResponse
    @Operation(summary = "거래별 기술적 실패 조회")
    @ApiResponse(responseCode = "404", description = "JUDGMENT_RUN_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @GetMapping("/{runId}/failures")
    public PageResponse<JudgmentRunFailureResponse> failures(
        @PathVariable UUID runId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return mockData.runFailures();
    }
}
