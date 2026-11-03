package com.ktc4.pusan4.assistant.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

/**
 * 비서 대화 한 턴 (api.md 3.14). AI 서버(agent-secretary.md 9장) 요청과 같은 모양이고 같은 규칙으로 막는다.
 * 그대로 AI 서버에 넘기므로 빈 필드는 싣지 않는다. AI 서버는 history·context 를 빼면 기본값을 쓰지만 null 은 422 로 거절한다.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ChatRequest(
    @Schema(requiredMode = REQUIRED, description = "1~1,000자") @NotBlank @Size(max = 1_000) String message,
    @Schema(description = "최근 메시지 20개 이하. 서버는 저장하지 않는다") @Size(max = 20) List<@NotNull @Valid Message> history,
    @Valid Context context,
    @Schema(description = "추적 세션 묶음용") @Pattern(regexp = "^[A-Za-z0-9_-]{1,64}$") String sessionId
) {

    public record Message(
        @Schema(allowableValues = {"user", "assistant"}) @NotNull @Pattern(regexp = "user|assistant") String role,
        @NotNull @Size(max = 2_000) String content
    ) {
    }

    /** 지금 화면과 보고 있는 대상. batchId·transactionId 는 요청한 사용자의 것이어야 한다. */
    public record Context(
        @Size(max = 200) String screen,
        UUID batchId,
        UUID transactionId,
        @Min(2_000) @Max(2_100) Integer year
    ) {
    }
}
