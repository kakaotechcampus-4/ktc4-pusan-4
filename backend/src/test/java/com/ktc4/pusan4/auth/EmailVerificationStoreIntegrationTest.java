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
        assertThat(store.issue(EMAIL, "123456").status()).isEqualTo(Status.ISSUED);

        assertThat(redis.getExpire("email-verify:code:" + EMAIL)).isBetween(1L, 300L);
        assertThat(redis.getExpire("email-verify:cooldown:" + EMAIL)).isBetween(1L, 60L);
        var again = store.issue(EMAIL, "654321");
        assertThat(again.status()).isEqualTo(Status.COOLDOWN);
        assertThat(again.retryAfter().toSeconds()).isBetween(0L, 60L);
    }

    @Test
    void resend_replaces_previous_code() {
        store.issue(EMAIL, "111111");
        redis.delete("email-verify:cooldown:" + EMAIL);
        store.issue(EMAIL, "222222");

        assertThat(store.confirm(EMAIL, "111111", "token")).isEqualTo(ConfirmResult.WRONG_CODE);
        assertThat(store.confirm(EMAIL, "222222", "token")).isEqualTo(ConfirmResult.VERIFIED);
    }

    @Test
    void confirm_stores_token_hash_and_drops_code() {
        store.issue(EMAIL, "123456");

        assertThat(store.confirm(EMAIL, "123456", "token")).isEqualTo(ConfirmResult.VERIFIED);

        assertThat(redis.hasKey("email-verify:code:" + EMAIL)).isFalse();
        assertThat(redis.opsForValue().get("email-verify:verified:" + EMAIL)).isNotEqualTo("token");
        assertThat(store.isVerified(EMAIL, "token")).isTrue();
        assertThat(store.isVerified(EMAIL, "other")).isFalse();
        assertThat(store.isVerified("other@example.com", "token")).isFalse();
        // 코드는 한 번만 쓴다
        assertThat(store.confirm(EMAIL, "123456", "token")).isEqualTo(ConfirmResult.NO_CODE);
    }

    @Test
    void code_is_discarded_after_max_wrong_attempts() {
        store.issue(EMAIL, "123456");

        for (int i = 0; i < EmailVerificationStore.MAX_ATTEMPTS; i++) {
            assertThat(store.confirm(EMAIL, "000000", "token")).isEqualTo(ConfirmResult.WRONG_CODE);
        }

        assertThat(store.confirm(EMAIL, "123456", "token")).isEqualTo(ConfirmResult.NO_CODE);
    }

    @Test
    void daily_limit_stops_new_codes() {
        for (int i = 0; i < EmailVerificationStore.DAILY_LIMIT; i++) {
            assertThat(store.issue(EMAIL, "123456").status()).isEqualTo(Status.ISSUED);
            redis.delete("email-verify:cooldown:" + EMAIL);
        }

        assertThat(store.issue(EMAIL, "123456").status()).isEqualTo(Status.DAILY_LIMIT);
        assertThat(redis.getExpire("email-verify:daily:" + EMAIL)).isPositive();
    }

    @Test
    void cancel_allows_immediate_retry() {
        store.issue(EMAIL, "123456");

        store.cancel(EMAIL);

        assertThat(store.issue(EMAIL, "654321").status()).isEqualTo(Status.ISSUED);
    }

    @Test
    void consume_removes_verification() {
        store.issue(EMAIL, "123456");
        store.confirm(EMAIL, "123456", "token");

        store.consumeVerified(EMAIL);

        assertThat(store.isVerified(EMAIL, "token")).isFalse();
    }
}
