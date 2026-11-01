package com.ktc4.pusan4.assistant.api;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.Map;

/** AI 서버 응답 그대로 (agent-secretary.md 9장). */
public record ChatResponse(
    String answer,
    @Schema(description = "제안 카드. [적용]을 누르면 프론트가 kind 로 기존 API 를 고른다") List<Map<String, Object>> proposals,
    String traceId
) {
}
