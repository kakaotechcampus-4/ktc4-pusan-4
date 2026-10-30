package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.assistant.AssistantRateLimiter;
import com.ktc4.pusan4.shared.api.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.context.ImportTestcontainers;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 비서 사용자별 한도 (api.md 3.14, agent-secretary.md 5장): 동시 1턴, 분당 10턴, 하루(한국 시각) 100턴. */
@SpringBootTest
@Testcontainers
@ImportTestcontainers(RedisTestContainer.class)
class AssistantRateLimiterIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    // 한국 시각 2026-10-28 14:00:30
    private static final Instant NOW = Instant.parse("2026-10-28T05:00:30Z");

    @Autowired
    private StringRedisTemplate redis;

    @Test
    void one_turn_at_a_time_per_user() {
        AssistantRateLimiter limiter = limiter(NOW);
        UUID user = UUID.randomUUID();

        AssistantRateLimiter.Lease first = limiter.acquire(user);
        assertThatThrownBy(() -> limiter.acquire(user))
            .isInstanceOfSatisfying(ApiException.class, e -> assertLimited(e, 5));
        limiter.acquire(UUID.randomUUID()).close();
        first.close();

        limiter.acquire(user).close();
    }

    @Test
    void ten_turns_per_minute() {
        AssistantRateLimiter limiter = limiter(NOW);
        UUID user = UUID.randomUUID();
        for (int i = 0; i < 10; i++) {
            limiter.acquire(user).close();
        }

        // 다음 분까지 30초
        assertThatThrownBy(() -> limiter.acquire(user))
            .isInstanceOfSatisfying(ApiException.class, e -> assertLimited(e, 30));
        // 막힌 요청이 동시 실행 자리를 붙잡지 않는다
        limiter(NOW.plusSeconds(60)).acquire(user).close();
    }

    @Test
    void hundred_turns_per_korean_day() {
        UUID user = UUID.randomUUID();
        for (int minute = 0; minute < 10; minute++) {
            AssistantRateLimiter limiter = limiter(NOW.plusSeconds(60L * minute));
            for (int i = 0; i < 10; i++) {
                limiter.acquire(user).close();
            }
        }

        // 14:10:30 → 한국 자정까지 9시간 49분 30초
        assertThatThrownBy(() -> limiter(NOW.plusSeconds(600)).acquire(user))
            .isInstanceOfSatisfying(ApiException.class, e -> assertLimited(e, 35_370));
        // 한국 시각으로 다음 날이면 다시 된다
        limiter(Instant.parse("2026-10-28T15:00:00Z")).acquire(user).close();
    }

    private AssistantRateLimiter limiter(Instant now) {
        return new AssistantRateLimiter(redis, Clock.fixed(now, ZoneOffset.UTC));
    }

    private static void assertLimited(ApiException exception, long retryAfterSeconds) {
        assertThat(exception.getStatus().value()).isEqualTo(429);
        assertThat(exception.getCode()).isEqualTo("ASSISTANT_RATE_LIMITED");
        assertThat(exception.getHeaders().getFirst("Retry-After")).isEqualTo(String.valueOf(retryAfterSeconds));
    }
}
