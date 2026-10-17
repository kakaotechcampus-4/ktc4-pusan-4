package com.ktc4.pusan4.auth.api;

import com.ktc4.pusan4.auth.AuthService;
import com.ktc4.pusan4.auth.AuthService.IssuedTokens;
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
    private final RefreshCookie refreshCookie;

    AuthController(AuthService authService, @Value("${app.auth.cookie-secure}") boolean secureCookie) {
        this.authService = authService;
        this.refreshCookie = new RefreshCookie(secureCookie);
    }

    @Operation(summary = "로그인", description = "액세스 토큰을 본문으로, 리프레시 토큰을 Set-Cookie 로 준다")
    @ApiResponse(responseCode = "401", description = "INVALID_CREDENTIALS",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/login")
    public ResponseEntity<AccessTokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return issued(authService.login(request.email(), request.password()));
    }

    @Operation(summary = "액세스 토큰 재발급", description = "리프레시 토큰 쿠키로 새 액세스 토큰과 새 리프레시 토큰을 준다")
    @ApiResponse(responseCode = "401", description = "INVALID_REFRESH_TOKEN — 쿠키가 없거나 만료",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/refresh")
    public ResponseEntity<AccessTokenResponse> refresh(
        @CookieValue(name = RefreshCookie.NAME, required = false) String refreshToken
    ) {
        return issued(authService.refresh(refreshToken));
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

    private ResponseEntity<AccessTokenResponse> issued(IssuedTokens tokens) {
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookie.issue(tokens.refreshToken()))
            .body(new AccessTokenResponse(tokens.accessToken()));
    }
}
