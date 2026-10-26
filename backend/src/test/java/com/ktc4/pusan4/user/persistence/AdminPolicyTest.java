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

    @Test
    void configured_email_is_admin_ignoring_case_and_spaces() {
        AdminPolicy policy = new AdminPolicy(userService, " Admin@Example.com , ops@example.com");

        assertThat(policy.roleOf(user("admin@example.com"))).isEqualTo(UserRole.ADMIN);
        assertThat(policy.roleOf(user("OPS@example.com"))).isEqualTo(UserRole.ADMIN);
        assertThat(policy.roleOf(user("demo@example.com"))).isEqualTo(UserRole.USER);
    }

    @Test
    void empty_setting_has_no_admin() {
        AdminPolicy policy = new AdminPolicy(userService, "");

        assertThat(policy.roleOf(user("admin@example.com"))).isEqualTo(UserRole.USER);
    }

    @Test
    void require_admin_returns_user_or_forbidden() {
        AdminPolicy policy = new AdminPolicy(userService, "admin@example.com");
        given(userService.get(USER_ID)).willReturn(user("admin@example.com"));
        assertThat(policy.requireAdmin(USER_ID).email()).isEqualTo("admin@example.com");

        given(userService.get(USER_ID)).willReturn(user("demo@example.com"));
        assertThatThrownBy(() -> policy.requireAdmin(USER_ID))
            .isInstanceOfSatisfying(ApiException.class, e -> {
                assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                assertThat(e.getCode()).isEqualTo("FORBIDDEN");
            });
    }

    private static AppUser user(String email) {
        return new AppUser(USER_ID, email, OffsetDateTime.parse("2026-09-01T10:00:00+09:00"));
    }
}
