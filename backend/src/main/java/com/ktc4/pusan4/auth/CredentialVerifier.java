package com.ktc4.pusan4.auth;

import java.util.Optional;
import java.util.UUID;

/**
 * 이메일·비밀번호 로그인 자격 확인. 구현은 {@link EmailPasswordCredentialVerifier} 다.
 */
public interface CredentialVerifier {

    /** 맞으면 그 사용자 id. 이메일이 없든 비밀번호가 틀리든 구분하지 않고 empty 다. */
    Optional<UUID> verify(String email, String password);
}
