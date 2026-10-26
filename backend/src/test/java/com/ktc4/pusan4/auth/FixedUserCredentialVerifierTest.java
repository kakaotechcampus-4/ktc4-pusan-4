package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.shared.auth.FixedUser;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FixedUserCredentialVerifierTest {

    private final FixedUserCredentialVerifier verifier = new FixedUserCredentialVerifier("demo-pass");

    @Test
    void fixed_user_with_configured_password_logs_in() {
        assertThat(verifier.verify(FixedUser.EMAIL, "demo-pass")).contains(FixedUser.ID);
    }

    @Test
    void email_is_case_insensitive() {
        assertThat(verifier.verify("Demo@Example.com", "demo-pass")).contains(FixedUser.ID);
    }

    @Test
    void wrong_password_is_rejected() {
        assertThat(verifier.verify(FixedUser.EMAIL, "demo-pas")).isEmpty();
    }

    @Test
    void other_email_is_rejected() {
        assertThat(verifier.verify("someone@example.com", "demo-pass")).isEmpty();
    }

    @Test
    void blank_configured_password_closes_login() {
        FixedUserCredentialVerifier closed = new FixedUserCredentialVerifier("");

        assertThat(closed.verify(FixedUser.EMAIL, "")).isEmpty();
        assertThat(closed.verify(FixedUser.EMAIL, "demo-pass")).isEmpty();
    }
}
