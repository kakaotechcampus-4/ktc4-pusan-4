package com.ktc4.pusan4.auth.api;

import com.ktc4.pusan4.auth.AuthService;
import com.ktc4.pusan4.auth.AuthService.IssuedTokens;
import com.ktc4.pusan4.auth.EmailVerificationService;
import com.ktc4.pusan4.shared.api.ErrorResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 인증 API 는 Authorization 없이 부른다. 요청마다 사용자를 확인하는 인터셉터(CurrentUserWebConfig)에서 빠져 있다.
 */
@Tag(name = "auth", description = "인증 (api.md 1.1). 액세스 토큰은 본문, 리프레시 토큰은 httpOnly 쿠키")
@SecurityRequirements
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final EmailVerificationService emailVerification;
    private final RefreshCookie refreshCookie;

    AuthController(AuthService authService, EmailVerificationService emailVerification,
        @Value("${app.auth.cookie-secure}") boolean secureCookie) {
        this.authService = authService;
        this.emailVerification = emailVerification;
        this.refreshCookie = new RefreshCookie(secureCookie);
    }

    @Operation(summary = "가입 인증 코드 메일 보내기",
        description = "6자리 코드를 메일로 보낸다. 코드는 5분 동안 쓸 수 있고, 다시 받으면 이전 코드는 쓸 수 없다")
    @ApiResponse(responseCode = "204", description = "보냄")
    @ApiResponse(responseCode = "409", description = "EMAIL_ALREADY_EXISTS",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "429", description = "VERIFICATION_RESEND_TOO_SOON — 60초 안에 다시 요청 / VERIFICATION_DAILY_LIMIT",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "502", description = "EMAIL_SEND_FAILED",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "503", description = "EMAIL_VERIFICATION_UNAVAILABLE — 서버에 메일 계정이 없음",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/email-verification")
    public ResponseEntity<Void> sendVerificationCode(@Valid @RequestBody EmailVerificationRequest request) {
        emailVerification.sendCode(request.email());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "가입 인증 코드 확인", description = "코드가 맞으면 가입에 쓸 인증 토큰(30분)을 준다")
    @ApiResponse(responseCode = "400",
        description = "INVALID_VERIFICATION_CODE — 틀림 / VERIFICATION_CODE_EXPIRED — 만료됐거나, 이미 썼거나, 5번 틀려 폐기됨",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/email-verification/confirm")
    public EmailVerificationResponse confirmVerificationCode(
        @Valid @RequestBody EmailVerificationConfirmRequest request
    ) {
        return new EmailVerificationResponse(emailVerification.confirm(request.email(), request.code()));
    }

    @Operation(summary = "이메일 회원가입",
        description = "메일 인증으로 받은 토큰을 함께 보낸다. 가입하고 바로 로그인한다. 응답은 로그인과 같고 상태만 201 이다")
    @ApiResponse(responseCode = "400", description = "EMAIL_NOT_VERIFIED — 인증 토큰이 없거나 틀렸거나 만료됨",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "409", description = "EMAIL_ALREADY_EXISTS",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/signup")
    public ResponseEntity<AccessTokenResponse> signup(@Valid @RequestBody SignupRequest request) {
        return issued(HttpStatus.CREATED,
            authService.signup(request.email(), request.password(), request.verificationToken()));
    }

    @Operation(summary = "로그인", description = "액세스 토큰을 본문으로, 리프레시 토큰을 Set-Cookie 로 준다")
    @ApiResponse(responseCode = "401", description = "INVALID_CREDENTIALS",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/login")
    public ResponseEntity<AccessTokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return issued(HttpStatus.OK, authService.login(request.email(), request.password()));
    }

    @Operation(summary = "카카오 로그인",
        description = "프론트 콜백 페이지가 받은 인가 코드를 넘긴다. 처음 온 카카오 회원이면 계정을 만든다. 응답은 로그인과 같다")
    @ApiResponse(responseCode = "401", description = "INVALID_KAKAO_CODE — 코드가 틀렸거나 만료됐거나 이미 씀",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "502", description = "KAKAO_UNAVAILABLE",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "503", description = "KAKAO_LOGIN_UNAVAILABLE — 서버에 카카오 키가 없음",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/kakao")
    public ResponseEntity<AccessTokenResponse> kakao(@Valid @RequestBody KakaoLoginRequest request) {
        return issued(HttpStatus.OK, authService.kakaoLogin(request.code()));
    }

    @Operation(summary = "액세스 토큰 재발급", description = "리프레시 토큰 쿠키로 새 액세스 토큰과 새 리프레시 토큰을 준다")
    @ApiResponse(responseCode = "401", description = "INVALID_REFRESH_TOKEN — 쿠키가 없거나 만료",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/refresh")
    public ResponseEntity<AccessTokenResponse> refresh(
        @CookieValue(name = RefreshCookie.NAME, required = false) String refreshToken
    ) {
        return issued(HttpStatus.OK, authService.refresh(refreshToken));
    }

    @Operation(summary = "로그아웃", description = "리프레시 토큰 쿠키를 지운다. 쿠키가 없어도 204")
    @ApiResponse(responseCode = "204", description = "로그아웃됨")
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
        @CookieValue(name = RefreshCookie.NAME, required = false) String refreshToken
    ) {
        authService.logout(refreshToken);
        return ResponseEntity.noContent()
            .header(HttpHeaders.SET_COOKIE, refreshCookie.clear())
            .build();
    }

    private ResponseEntity<AccessTokenResponse> issued(HttpStatus status, IssuedTokens tokens) {
        return ResponseEntity.status(status)
            .header(HttpHeaders.SET_COOKIE, refreshCookie.issue(tokens.refreshToken()))
            .body(new AccessTokenResponse(tokens.accessToken()));
    }
}
