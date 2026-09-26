package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.shared.api.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
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

    @Operation(summary = "Batch 전체 판정 실행",
        description = "같은 Batch 에 여러 번 실행할 수 있고, 다시 판정하면 새 revision 을 만든다")
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public JudgmentRunCreatedResponse create(@RequestBody CreateJudgmentRunRequest request) {
        throw ApiException.notImplemented();
    }

    @Operation(summary = "판정 실행 상태 조회")
    @GetMapping("/{runId}")
    public JudgmentRunResponse detail(@PathVariable UUID runId) {
        throw ApiException.notImplemented();
    }

    @Operation(summary = "거래별 기술적 실패 조회")
    @GetMapping("/{runId}/failures")
    public PageResponse<JudgmentRunFailureResponse> failures(
        @PathVariable UUID runId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        throw ApiException.notImplemented();
    }
}
