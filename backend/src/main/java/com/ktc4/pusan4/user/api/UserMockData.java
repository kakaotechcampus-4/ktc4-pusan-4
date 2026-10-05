package com.ktc4.pusan4.user.api;

import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import static com.ktc4.pusan4.shared.api.MockFixtures.CONTEXT_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.USER_ID;

/**
 * 서비스 레이어가 붙기 전까지 users·contexts API 가 반환하는 고정 응답.
 */
@Component
public class UserMockData {

    public UserResponse me() {
        return new UserResponse(USER_ID, "demo@example.com", OffsetDateTime.parse("2026-09-01T10:00:00+09:00"));
    }

    public ContextCreatedResponse createContext() {
        return new ContextCreatedResponse(CONTEXT_ID, 1);
    }

    public ContextResponse currentContext() {
        return new ContextResponse(CONTEXT_ID, USER_ID, 1, "62010", 82_000_000L, LocalDate.parse("2024-03-15"),
            BookkeepingDuty.간편장부, false, 20, OffsetDateTime.parse("2026-09-01T10:05:00+09:00"));
    }

    public List<ContextResponse> contextHistory() {
        return List.of(currentContext());
    }
}
