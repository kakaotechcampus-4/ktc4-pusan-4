package com.ktc4.pusan4.user.persistence;

import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.user.domain.AppUser;
import com.ktc4.pusan4.user.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

class AdminPolicyTest {

    private static final UUID USER_ID = UUID.fromString("0199c8f2-0000-7000-8000-000000000001");

    private final UserService userService = mock(UserService.class);
    private final AdminPolicy policy = new AdminPolicy(userService);

    @Test
    void admin_role_passes() {
        given(userService.get(USER_ID)).willReturn(user(UserRole.ADMIN));

        assertThat(policy.requireAdmin(USER_ID).role()).isEqualTo(UserRole.ADMIN);
    }

    @Test
    void user_role_is_forbidden() {
        given(userService.get(USER_ID)).willReturn(user(UserRole.USER));

        assertThatThrownBy(() -> policy.requireAdmin(USER_ID))
            .isInstanceOfSatisfying(ApiException.class, e -> {
                assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                assertThat(e.getCode()).isEqualTo("FORBIDDEN");
            });
    }

    private static AppUser user(UserRole role) {
        return new AppUser(USER_ID, "user@example.com", role, OffsetDateTime.parse("2026-09-01T10:00:00+09:00"));
    }
}
