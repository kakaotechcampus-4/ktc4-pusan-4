package com.ktc4.pusan4.progress.api;

import com.ktc4.pusan4.progress.persistence.ProgressService;
import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.auth.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "progress", description = "업로드 진행 상황과 다음 할 일 (api.md 3.14)")
@RestController
public class ProgressController {

    private final ProgressService progressService;

    public ProgressController(ProgressService progressService) {
        this.progressService = progressService;
    }

    @Operation(summary = "업로드 진행 상황",
        description = "업로드 요약, 문진(버전·기장의무·직원 유무만), 분류 대기, 최근 판정 실행, 미답변 질문과 지난번 답으로 "
            + "채울 수 있는 질문 수, 다음 할 일. 수입금액·이름·이메일은 담지 않는다")
    @ApiResponse(responseCode = "404", description = "BATCH_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @GetMapping("/progress")
    public ProgressResponse progress(CurrentUser currentUser, @RequestParam UUID batchId) {
        return ProgressResponse.from(progressService.progress(currentUser.id(), batchId));
    }
}
