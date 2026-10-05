package com.ktc4.pusan4.user.api;

import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.api.MockResponse;
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

    private final UserMockData mockData;

    public BusinessContextController(UserMockData mockData) {
        this.mockData = mockData;
    }

    @MockResponse
    @Operation(summary = "사업자 Context 생성")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ContextCreatedResponse create(@Valid @RequestBody CreateContextRequest request) {
        return mockData.createContext();
    }

    @MockResponse
    @Operation(summary = "현재 Context 조회")
    @ApiResponse(responseCode = "404", description = "CONTEXT_NOT_FOUND — 문진 전",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @GetMapping("/current")
    public ContextResponse current() {
        return mockData.currentContext();
    }

    @MockResponse
    @Operation(summary = "Context 버전 이력 조회", description = "version 오름차순. 페이지네이션 없음")
    @GetMapping
    public List<ContextResponse> history() {
        return mockData.contextHistory();
    }
}
