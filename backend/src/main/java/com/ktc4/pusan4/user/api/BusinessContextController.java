package com.ktc4.pusan4.user.api;

import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.auth.CurrentUser;
import com.ktc4.pusan4.user.persistence.BusinessContextService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "contexts", description = "사업자 Context (api.md 3.2). 수정하지 않고 새 버전을 만든다")
@RestController
@RequestMapping("/users/me/contexts")
public class BusinessContextController {

    private final BusinessContextService contextService;

    public BusinessContextController(BusinessContextService contextService) {
        this.contextService = contextService;
    }

    @Operation(summary = "사업자 Context 생성", description = "기존 버전을 고치지 않고 다음 버전을 만든다")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ContextCreatedResponse create(CurrentUser currentUser, @Valid @RequestBody CreateContextRequest request) {
        return ContextCreatedResponse.from(contextService.create(currentUser.id(), request.toInput()));
    }

    @Operation(summary = "현재 Context 조회", description = "가장 높은 version")
    @ApiResponse(responseCode = "404", description = "CONTEXT_NOT_FOUND — 문진 전",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @GetMapping("/current")
    public ContextResponse current(CurrentUser currentUser) {
        return ContextResponse.from(contextService.current(currentUser.id()));
    }

    @Operation(summary = "Context 버전 이력 조회", description = "version 오름차순. 페이지네이션 없음. 문진 전이면 빈 배열")
    @GetMapping
    public List<ContextResponse> history(CurrentUser currentUser) {
        return contextService.history(currentUser.id()).stream().map(ContextResponse::from).toList();
    }
}
