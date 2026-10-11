package com.ktc4.pusan4.shared.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * 인증 도입 전 임시 구현. 요청과 상관없이 항상 같은 사용자다. B9b 에서 {@link TemporaryUserSeeder} 와 함께 지운다.
 */
@Component
public class TemporaryCurrentUserProvider implements CurrentUserProvider {

    /** 목 응답(MockFixtures.USER_ID)과 같은 값이라, 아직 목인 API 의 userId 와도 맞는다. */
    public static final UUID TEMPORARY_USER_ID = UUID.fromString("0199c8f2-0000-7000-8000-000000000001");
    public static final String TEMPORARY_USER_EMAIL = "demo@example.com";

    private static final CurrentUser TEMPORARY_USER = new CurrentUser(TEMPORARY_USER_ID);

    @Override
    public CurrentUser resolve(HttpServletRequest request) {
        return TEMPORARY_USER;
    }
}
