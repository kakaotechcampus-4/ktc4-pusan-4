package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.auth.RefreshTokenStore.RefreshToken;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.user.persistence.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * 회원가입·로그인(이메일·카카오)·재발급·로그아웃 (api.md 1.1). 자격 확인과 리프레시 토큰 보관은 인터페이스 뒤에 있다.
 */
@Service
public class AuthService {

    private final CredentialVerifier credentials;
    private final AccessTokens accessTokens;
    private final RefreshTokenStore refreshTokens;
    private final UserService users;
    private final PasswordEncoder passwordEncoder;
    private final KakaoClient kakao;
    private final EmailVerificationService emailVerification;

    AuthService(CredentialVerifier credentials, AccessTokens accessTokens, RefreshTokenStore refreshTokens,
        UserService users, PasswordEncoder passwordEncoder, KakaoClient kakao,
        EmailVerificationService emailVerification) {
        this.credentials = credentials;
        this.accessTokens = accessTokens;
        this.refreshTokens = refreshTokens;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.kakao = kakao;
        this.emailVerification = emailVerification;
    }

    /** 카카오 인가 코드로 로그인한다. 처음 온 카카오 회원이면 계정을 만든다. */
    public IssuedTokens kakaoLogin(String code) {
        return issue(users.findOrCreateKakaoAccount(kakao.userId(code)));
    }

    /**
     * 메일 인증을 마친 이메일로 가입하고 바로 로그인한다. 인증 토큰은 가입이 끝나면 지운다.
     * 같은 토큰으로 동시에 가입해도 UNIQUE(email) 때문에 하나만 남는다.
     */
    public IssuedTokens signup(String email, String password, String verificationToken) {
        if (!Passwords.fitsBcrypt(password)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "비밀번호는 72바이트를 넘을 수 없습니다.");
        }
        emailVerification.requireVerified(email, verificationToken);
        UUID userId = users.registerEmailAccount(email, passwordEncoder.encode(password))
            .orElseThrow(AuthService::emailAlreadyExists);
        emailVerification.consume(email);
        return issue(userId);
    }

    public IssuedTokens login(String email, String password) {
        return credentials.verify(email, password)
            .map(this::issue)
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS",
                "이메일 또는 비밀번호가 맞지 않습니다."));
    }

    /** @param refreshToken 쿠키 값. 없으면 null */
    public IssuedTokens refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw invalidRefreshToken();
        }
        return refreshTokens.rotate(refreshToken)
            .map(rotation -> new IssuedTokens(accessTokens.issue(rotation.userId()), rotation.next()))
            .orElseThrow(AuthService::invalidRefreshToken);
    }

    /** 이미 로그아웃했거나 쿠키가 없어도 실패하지 않는다. */
    public void logout(String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            refreshTokens.revoke(refreshToken);
        }
    }

    /** 그 사용자의 모든 로그인을 끊는다. 탈퇴할 때 쓴다. 이미 발급된 액세스 토큰은 만료(15분)까지 남는다. */
    public void logoutEverywhere(UUID userId) {
        refreshTokens.revokeAll(userId);
    }

    private IssuedTokens issue(UUID userId) {
        return new IssuedTokens(accessTokens.issue(userId), refreshTokens.issue(userId));
    }

    static ApiException emailAlreadyExists() {
        return new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "이미 가입한 이메일입니다.");
    }

    private static ApiException invalidRefreshToken() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "다시 로그인해 주세요.");
    }

    public record IssuedTokens(String accessToken, RefreshToken refreshToken) {
    }
}
