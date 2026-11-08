package com.ktc4.pusan4.user.api;

import com.ktc4.pusan4.auth.AuthService;
import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.auth.CurrentUser;
import com.ktc4.pusan4.user.persistence.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "users", description = "사용자 (api.md 3.1)")
@RestController
@RequestMapping("/users/me")
public class UserController {

    private final UserService userService;
    private final AuthService authService;

    public UserController(UserService userService, AuthService authService) {
        this.userService = userService;
        this.authService = authService;
    }

    @Operation(summary = "내 정보 조회", description = "role 이 ADMIN 이면 관리자 API(규칙 후보)를 쓸 수 있다")
    @GetMapping
    public UserResponse me(CurrentUser currentUser) {
        return UserResponse.from(userService.get(currentUser.id()));
    }

    @Operation(summary = "비밀번호 변경",
        description = "현재 비밀번호를 확인하고 바꾼 뒤 모든 기기(지금 기기 포함)의 로그인을 끊는다. 화면은 로그인으로 보낸다")
    @ApiResponse(responseCode = "400", description = "INVALID_CURRENT_PASSWORD, VALIDATION_ERROR(새 비밀번호 규칙)",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "409", description = "PASSWORD_NOT_SET — 비밀번호가 없는 계정(카카오 가입)",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PutMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(CurrentUser currentUser, @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(currentUser.id(), request.currentPassword(), request.newPassword());
    }

    @Operation(summary = "회원 탈퇴",
        description = "업로드한 카드내역과 거래, 판정 결과, 질문과 답변, 문진 정보, 개인 가맹점 사전을 함께 지운다. "
            + "법령, 전역 가맹점 사전, 룰 후보는 남는다")
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMe(CurrentUser currentUser) {
        // 로그인을 먼저 끊는다. Redis 가 실패하면 탈퇴도 하지 않아, 지워진 사용자의 리프레시 토큰이 남지 않는다
        authService.logoutEverywhere(currentUser.id());
        userService.delete(currentUser.id());
    }
}
