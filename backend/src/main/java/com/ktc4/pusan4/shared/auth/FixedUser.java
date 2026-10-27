package com.ktc4.pusan4.shared.auth;

import java.util.UUID;

/**
 * 실제 계정이 생기기 전까지 로그인할 수 있는 유일한 사용자. {@link TemporaryUserSeeder} 가 행을 만들고,
 * 고정 인증(FixedUserCredentialVerifier)이 이 이메일만 통과시킨다. 실제 계정(B9b) 때 함께 지운다.
 */
public final class FixedUser {

    /** 목 응답(MockFixtures.USER_ID)과 같은 값이라, 아직 목인 API 의 userId 와도 맞는다. */
    public static final UUID ID = UUID.fromString("0199c8f2-0000-7000-8000-000000000001");
    public static final String EMAIL = "demo@example.com";

    private FixedUser() {
    }
}
