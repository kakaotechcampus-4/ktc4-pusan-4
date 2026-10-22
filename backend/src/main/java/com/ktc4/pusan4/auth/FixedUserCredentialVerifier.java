package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.user.persistence.UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Optional;
import java.util.UUID;

/**
 * 데모 로그인(demo/poc-gcp 전용). 비밀번호가 설정(APP_AUTH_DEMO_PASSWORD)과 같으면 어떤 이메일이든 통과시키고,
 * 처음 보는 이메일이면 그 자리에서 사용자를 만든다. 발표에서 여러 사람이 서로의 데이터와 섞이지 않게 쓰기 위한 것이다.
 * 비밀번호 설정이 비어 있으면 아무도 로그인할 수 없다 — 설정을 빠뜨린 서버가 열리지 않게 닫힌 쪽으로 떨어뜨린다.
 */
@Component
class FixedUserCredentialVerifier implements CredentialVerifier {

    /** app_user.email 의 길이 */
    private static final int MAX_EMAIL_LENGTH = 320;

    private final byte[] password;
    private final UserService users;

    FixedUserCredentialVerifier(@Value("${app.auth.demo-password}") String password, UserService users) {
        this.password = password.getBytes(StandardCharsets.UTF_8);
        this.users = users;
    }

    @Override
    public Optional<UUID> verify(String email, String password) {
        if (this.password.length == 0 || email.isBlank() || email.length() > MAX_EMAIL_LENGTH) {
            return Optional.empty();
        }
        // 길이·내용에 따라 걸리는 시간이 달라지지 않게 비교한다
        boolean matches = MessageDigest.isEqual(this.password, password.getBytes(StandardCharsets.UTF_8));
        return matches ? Optional.of(users.findOrCreateByEmail(email)) : Optional.empty();
    }
}
