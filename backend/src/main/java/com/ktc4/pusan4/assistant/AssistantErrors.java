package com.ktc4.pusan4.assistant;

import com.ktc4.pusan4.shared.api.ApiException;
import org.springframework.http.HttpStatus;

final class AssistantErrors {

    private AssistantErrors() {
    }

    /** AI 서버나 한도 저장소(Redis)에 닿지 못했다. 비서만 쓸 수 없고 다른 화면은 그대로다(QR-4). */
    static ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "ASSISTANT_UNAVAILABLE",
            "지금은 비서를 쓸 수 없습니다. 잠시 뒤 다시 시도해 주세요.");
    }
}
