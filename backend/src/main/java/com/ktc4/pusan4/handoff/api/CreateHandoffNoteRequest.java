package com.ktc4.pusan4.handoff.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record CreateHandoffNoteRequest(
    @Schema(example = "휴대폰 요금의 업무 비중을 어떻게 잡으면 될까요?") @NotBlank @Size(max = 300) String text,
    @Schema(description = "질문과 관련된 본인 거래. 없으면 빈 배열") @NotNull @Size(max = 50) List<@NotNull UUID> transactionIds
) {
}
