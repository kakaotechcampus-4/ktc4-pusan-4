package com.ktc4.pusan4.bugreport.api;

import com.ktc4.pusan4.bugreport.BugReportService;
import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.auth.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "bug-reports", description = "버그 신고 (api.md 3.16)")
@RestController
public class BugReportController {

    private final BugReportService bugReportService;

    public BugReportController(BugReportService bugReportService) {
        this.bugReportService = bugReportService;
    }

    @Operation(summary = "버그 신고", description = "팀 메일로 보낸다. 저장하지 않는다. 사용자마다 한 시간에 5건")
    @ApiResponse(responseCode = "429", description = "BUG_REPORT_RATE_LIMITED",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "502", description = "BUG_REPORT_SEND_FAILED — 잠시 뒤 다시 보낸다",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "503", description = "BUG_REPORT_UNAVAILABLE — 서버에 메일 계정이 없음",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/bug-reports")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void report(CurrentUser currentUser, @Valid @RequestBody BugReportRequest request) {
        bugReportService.report(currentUser.id(), request.message(), request.pageUrl(), request.userAgent(),
            request.traceId());
    }
}
