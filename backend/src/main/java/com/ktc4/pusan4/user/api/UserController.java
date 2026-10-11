package com.ktc4.pusan4.user.api;

import com.ktc4.pusan4.shared.api.MockResponse;
import com.ktc4.pusan4.shared.auth.CurrentUser;
import com.ktc4.pusan4.user.persistence.UserService;
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

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @Operation(summary = "내 정보 조회")
    @GetMapping
    public UserResponse me(CurrentUser currentUser) {
        return UserResponse.from(userService.get(currentUser.id()));
    }

    @MockResponse
    @Operation(summary = "회원 탈퇴")
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMe() {
        // 목 응답: 지울 데이터가 없다. 삭제 정책이 갖춰진 뒤 B6 에서 구현한다.
    }
}
