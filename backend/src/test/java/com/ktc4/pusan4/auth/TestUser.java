package com.ktc4.pusan4.auth;

import java.util.UUID;

/**
 * 테스트의 기본 요청 사용자. {@link DefaultBearerTokenContextCustomizerFactory} 가 기동할 때 행을 만들고,
 * 자동 구성 MockMvc 요청에 이 사용자의 액세스 토큰을 싣는다. 비밀번호가 없어 로그인 API 로는 들어올 수 없다.
 */
public final class TestUser {

    public static final UUID ID = UUID.fromString("0199c8f2-0000-7000-8000-000000000001");
    public static final String EMAIL = "demo@example.com";

    private TestUser() {
    }
}
