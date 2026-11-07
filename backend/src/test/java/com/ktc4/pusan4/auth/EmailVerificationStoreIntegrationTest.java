package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.auth.EmailVerificationStore.ConfirmResult;
import com.ktc4.pusan4.auth.EmailVerificationStore.IssueResult.Status;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static com.ktc4.pusan4.auth.VerificationPurpose.PASSWORD_RESET;
import static com.ktc4.pusan4.auth.VerificationPurpose.SIGNUP;
import static org.assertj.core.api.Assertions.assertThat;

/** 메일 인증 저장 규칙(EmailVerificationStore 주석)을 실제 Redis 로 확인한다. 스프링 컨텍스트 없이 저장소만 띄운다. */
@Testcontainers
class EmailVerificationStoreIntegrationTest {

    @Container
    static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7.4-alpine").withExposedPorts(6379);

    private static final String EMAIL = "user@example.com";

    private static LettuceConnectionFactory connectionFactory;
    private static StringRedisTemplate redis;

    private EmailVerificationStore store;

    @BeforeAll
    static void connect() {
        connectionFactory = new LettuceConnectionFactory(
            new RedisStandaloneConfiguration(REDIS.getHost(), REDIS.getMappedPort(6379)));
        connectionFactory.afterPropertiesSet();
        connectionFactory.start();
        redis = new StringRedisTemplate(connectionFactory);
    }

    @AfterAll
    static void disconnect() {
        connectionFactory.destroy();
    }

    @BeforeEach
    void flush() {
        redis.execute(connection -> {
            connection.serverCommands().flushAll();
            return null;
        }, true);
        store = new EmailVerificationStore(redis);
    }

    @Test
    void issue_sets_code_and_cooldown_with_ttl() {
        assertThat(store.issue(SIGNUP, EMAIL, "123456").status()).isEqualTo(Status.ISSUED);

        assertThat(redis.getExpire("email-verify:code:" + EMAIL)).isBetween(1L, 300L);
        assertThat(redis.getExpire("email-verify:cooldown:" + EMAIL)).isBetween(1L, 60L);
        var again = store.issue(SIGNUP, EMAIL, "654321");
        assertThat(again.status()).isEqualTo(Status.COOLDOWN);
        assertThat(again.retryAfter().toSeconds()).isBetween(0L, 60L);
    }

    @Test
    void resend_replaces_previous_code() {
        store.issue(SIGNUP, EMAIL, "111111");
        redis.delete("email-verify:cooldown:" + EMAIL);
        store.issue(SIGNUP, EMAIL, "222222");

        assertThat(store.confirm(SIGNUP, EMAIL, "111111", "token")).isEqualTo(ConfirmResult.WRONG_CODE);
        assertThat(store.confirm(SIGNUP, EMAIL, "222222", "token")).isEqualTo(ConfirmResult.VERIFIED);
    }

    @Test
    void confirm_stores_token_hash_and_drops_code() {
        store.issue(SIGNUP, EMAIL, "123456");

        assertThat(store.confirm(SIGNUP, EMAIL, "123456", "token")).isEqualTo(ConfirmResult.VERIFIED);

        assertThat(redis.hasKey("email-verify:code:" + EMAIL)).isFalse();
        assertThat(redis.opsForValue().get("email-verify:verified:" + EMAIL)).isNotEqualTo("token");
        assertThat(store.isVerified(SIGNUP, EMAIL, "token")).isTrue();
        assertThat(store.isVerified(SIGNUP, EMAIL, "other")).isFalse();
        assertThat(store.isVerified(SIGNUP, "other@example.com", "token")).isFalse();
        // 코드는 한 번만 쓴다
        assertThat(store.confirm(SIGNUP, EMAIL, "123456", "token")).isEqualTo(ConfirmResult.NO_CODE);
    }

    @Test
    void code_is_discarded_after_max_wrong_attempts() {
        store.issue(SIGNUP, EMAIL, "123456");

        for (int i = 0; i < EmailVerificationStore.MAX_ATTEMPTS; i++) {
            assertThat(store.confirm(SIGNUP, EMAIL, "000000", "token")).isEqualTo(ConfirmResult.WRONG_CODE);
        }

        assertThat(store.confirm(SIGNUP, EMAIL, "123456", "token")).isEqualTo(ConfirmResult.NO_CODE);
    }

    @Test
    void daily_limit_stops_new_codes() {
        for (int i = 0; i < EmailVerificationStore.DAILY_LIMIT; i++) {
            assertThat(store.issue(SIGNUP, EMAIL, "123456").status()).isEqualTo(Status.ISSUED);
            redis.delete("email-verify:cooldown:" + EMAIL);
        }

        assertThat(store.issue(SIGNUP, EMAIL, "123456").status()).isEqualTo(Status.DAILY_LIMIT);
        assertThat(redis.getExpire("email-verify:daily:" + EMAIL)).isPositive();
    }

    @Test
    void signup_and_password_reset_codes_do_not_mix() {
        // given: 같은 이메일에 가입 코드와 재설정 코드를 따로 받았다
        store.issue(SIGNUP, EMAIL, "111111");
        store.issue(PASSWORD_RESET, EMAIL, "222222");

        // then: 한쪽 코드로 다른 쪽을 인증할 수 없고, 받은 토큰도 그 용도에서만 맞다
        assertThat(store.confirm(SIGNUP, EMAIL, "222222", "token")).isEqualTo(ConfirmResult.WRONG_CODE);
        assertThat(store.confirm(PASSWORD_RESET, EMAIL, "222222", "token")).isEqualTo(ConfirmResult.VERIFIED);
        assertThat(store.isVerified(PASSWORD_RESET, EMAIL, "token")).isTrue();
        assertThat(store.isVerified(SIGNUP, EMAIL, "token")).isFalse();
    }

    @Test
    void refund_keeps_cooldown_and_code() {
        store.issue(SIGNUP, EMAIL, "123456");

        store.refund(SIGNUP, EMAIL);

        assertThat(store.issue(SIGNUP, EMAIL, "654321").status()).isEqualTo(Status.COOLDOWN);
        assertThat(store.confirm(SIGNUP, EMAIL, "123456", "token")).isEqualTo(ConfirmResult.VERIFIED);
    }

    @Test
    void refunded_sends_do_not_count_toward_daily_limit() {
        for (int i = 0; i < EmailVerificationStore.DAILY_LIMIT; i++) {
            assertThat(store.issue(SIGNUP, EMAIL, "123456").status()).isEqualTo(Status.ISSUED);
            store.refund(SIGNUP, EMAIL);
            redis.delete("email-verify:cooldown:" + EMAIL);
        }

        assertThat(store.issue(SIGNUP, EMAIL, "123456").status()).isEqualTo(Status.ISSUED);
        assertThat(redis.opsForValue().get("email-verify:daily:" + EMAIL)).isEqualTo("1");
    }

    @Test
    void refund_after_daily_key_expired_does_not_go_negative() {
        store.issue(SIGNUP, EMAIL, "123456");
        redis.delete("email-verify:daily:" + EMAIL);

        store.refund(SIGNUP, EMAIL);

        assertThat(redis.hasKey("email-verify:daily:" + EMAIL)).isFalse();
    }

    @Test
    void consume_removes_verification() {
        store.issue(SIGNUP, EMAIL, "123456");
        store.confirm(SIGNUP, EMAIL, "123456", "token");

        store.consumeVerified(SIGNUP, EMAIL);

        assertThat(store.isVerified(SIGNUP, EMAIL, "token")).isFalse();
    }
}
