package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.api.MockResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "judgments", description = "판정 결과 (api.md 3.7, 3.8)")
@RestController
@RequestMapping("/judgment-overrides")
public class JudgmentOverrideController {

    @MockResponse
    @Operation(summary = "사용자 판정 수정 해제",
        description = "Override 와 그 revision 은 삭제하지 않고 active=false, releasedAt 을 기록한다. "
            + "이미 해제된 Override 도 204")
    @ApiResponse(responseCode = "404", description = "JUDGMENT_OVERRIDE_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @DeleteMapping("/{overrideId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void release(@PathVariable UUID overrideId) {
        // 목 응답: 해제할 Override 가 없다
    }
}
