package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.user.domain.EmailCredential;
import com.ktc4.pusan4.user.persistence.UserService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * 이메일 계정의 비밀번호를 BCrypt 해시와 비교한다.
 * 없는 이메일에도 같은 비교를 한 번 해서, 응답 시간으로 가입 여부가 드러나지 않게 한다.
 */
@Component
class EmailPasswordCredentialVerifier implements CredentialVerifier {

    private final UserService users;
    private final PasswordEncoder passwordEncoder;
    private final String unknownUserHash;

    EmailPasswordCredentialVerifier(UserService users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.unknownUserHash = passwordEncoder.encode("unknown-user-password");
    }

    @Override
    public Optional<UUID> verify(String email, String password) {
        if (!Passwords.fitsBcrypt(password)) {
            return Optional.empty();
        }
        Optional<EmailCredential> credential = users.findEmailCredential(email);
        boolean matches = passwordEncoder.matches(password,
            credential.map(EmailCredential::passwordHash).orElse(unknownUserHash));
        return credential.filter(found -> matches).map(EmailCredential::userId);
    }
}
