package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.user.persistence.UserService;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** 이메일로 사용자를 찾고 만드는 동작은 AuthIntegrationTest 가 실제 DB 로 본다. */
class FixedUserCredentialVerifierTest {

    private final UserService users = mock(UserService.class);
    private final FixedUserCredentialVerifier verifier = new FixedUserCredentialVerifier("demo-pass", users);

    @Test
    void any_email_with_configured_password_logs_in_as_that_user() {
        UUID id = UUID.randomUUID();
        given(users.findOrCreateByEmail("someone@example.com")).willReturn(id);

        assertThat(verifier.verify("someone@example.com", "demo-pass")).contains(id);
    }

    @Test
    void wrong_password_is_rejected_without_creating_user() {
        assertThat(verifier.verify("someone@example.com", "demo-pas")).isEmpty();
        verify(users, never()).findOrCreateByEmail(any());
    }

    @Test
    void blank_or_too_long_email_is_rejected() {
        assertThat(verifier.verify(" ", "demo-pass")).isEmpty();
        assertThat(verifier.verify("a".repeat(321), "demo-pass")).isEmpty();
        verify(users, never()).findOrCreateByEmail(any());
    }

    @Test
    void blank_configured_password_closes_login() {
        FixedUserCredentialVerifier closed = new FixedUserCredentialVerifier("", users);

        assertThat(closed.verify("someone@example.com", "")).isEmpty();
        assertThat(closed.verify("someone@example.com", "demo-pass")).isEmpty();
        verify(users, never()).findOrCreateByEmail(any());
    }
}
