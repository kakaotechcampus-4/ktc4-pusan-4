package com.ktc4.pusan4.assistant.api;

import com.ktc4.pusan4.assistant.AssistantRelayService;
import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.auth.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "assistant", description = "비서 Really 대화 중계 (api.md 3.14, docs/agent-secretary.md)")
@RestController
public class AssistantController {

    private final AssistantRelayService relayService;

    public AssistantController(AssistantRelayService relayService) {
        this.relayService = relayService;
    }

    @Operation(summary = "비서 대화 한 턴",
        description = "AI 서버로 중계한다. 요청의 Authorization 헤더만 함께 넘겨, 비서는 사용자 본인 권한으로만 조회한다. "
            + "context 의 batchId·transactionId 는 요청한 사용자의 것이어야 한다. 사용자마다 동시 1턴, 분당 10턴, "
            + "하루(한국 시각) 100턴. 대화 기록은 저장하지 않는다")
    @ApiResponse(responseCode = "404", description = "BATCH_NOT_FOUND, TRANSACTION_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "429", description = "ASSISTANT_RATE_LIMITED (Retry-After 헤더)",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "503", description = "ASSISTANT_UNAVAILABLE",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/assistant/chat")
    public ChatResponse chat(
        CurrentUser currentUser,
        @Parameter(hidden = true) @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
        @Valid @RequestBody ChatRequest request
    ) {
        return relayService.chat(currentUser.id(), authorization, request);
    }
}
