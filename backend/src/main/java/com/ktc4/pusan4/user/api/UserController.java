package com.ktc4.pusan4.user.api;

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

    @Operation(summary = "회원 탈퇴",
        description = "업로드한 카드내역과 거래, 판정 결과, 질문과 답변, 문진 정보, 개인 가맹점 사전을 함께 지운다. "
            + "법령, 전역 가맹점 사전, 룰 후보는 남는다")
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMe(CurrentUser currentUser) {
        userService.delete(currentUser.id());
    }
}
