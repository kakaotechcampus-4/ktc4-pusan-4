package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.shared.auth.FixedUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Optional;
import java.util.UUID;

/**
 * 고정 사용자({@link FixedUser}) 하나만 통과시킨다. 비밀번호는 설정(APP_AUTH_DEMO_PASSWORD)에서 받고,
 * 비어 있으면 아무도 로그인할 수 없다 — 설정을 빠뜨린 서버가 열리지 않게 닫힌 쪽으로 떨어뜨린다.
 */
@Component
class FixedUserCredentialVerifier implements CredentialVerifier {

    private final byte[] password;

    FixedUserCredentialVerifier(@Value("${app.auth.demo-password}") String password) {
        this.password = password.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public Optional<UUID> verify(String email, String password) {
        if (this.password.length == 0 || !FixedUser.EMAIL.equalsIgnoreCase(email)) {
            return Optional.empty();
        }
        // 길이·내용에 따라 걸리는 시간이 달라지지 않게 비교한다
        boolean matches = MessageDigest.isEqual(this.password, password.getBytes(StandardCharsets.UTF_8));
        return matches ? Optional.of(FixedUser.ID) : Optional.empty();
    }
}
