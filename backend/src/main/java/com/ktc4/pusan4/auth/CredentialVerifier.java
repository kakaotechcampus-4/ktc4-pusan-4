package com.ktc4.pusan4.auth;

import java.util.Optional;
import java.util.UUID;

/**
 * 로그인 자격 확인. 지금은 {@link FixedUserCredentialVerifier}(고정 사용자 하나)이고,
 * 실제 계정·카카오 로그인(B9b)이 정해지면 구현체만 바꾼다.
 */
public interface CredentialVerifier {

    /** 맞으면 그 사용자 id. 이메일이 없든 비밀번호가 틀리든 구분하지 않고 empty 다. */
    Optional<UUID> verify(String email, String password);
}
