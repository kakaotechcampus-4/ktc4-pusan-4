package com.ktc4.pusan4.user.api;

import com.ktc4.pusan4.shared.api.MockResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "users", description = "사용자 (api.md 3.1)")
@RestController
@RequestMapping("/users/me")
public class UserController {

    private final UserMockData mockData;

    public UserController(UserMockData mockData) {
        this.mockData = mockData;
    }

    @MockResponse
    @Operation(summary = "내 정보 조회")
    @GetMapping
    public UserResponse me() {
        return mockData.me();
    }

    @MockResponse
    @Operation(summary = "회원 탈퇴")
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMe() {
        // 목 응답: 지울 데이터가 없다
    }
}
