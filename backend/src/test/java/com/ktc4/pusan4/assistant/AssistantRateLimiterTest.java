package com.ktc4.pusan4.assistant;

import com.ktc4.pusan4.shared.api.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Redis 가 중간에 실패할 때. 한도 자체는 AssistantRateLimiterIntegrationTest 가 실제 Redis 로 본다. */
class AssistantRateLimiterTest {

    private static final UUID USER = UUID.randomUUID();
    private static final List<String> RUNNING_KEY = List.of("assistant:running:" + USER);

    @SuppressWarnings("unchecked")
    private final ValueOperations<String, String> values = mock(ValueOperations.class);
    private final StringRedisTemplate redis = mock(StringRedisTemplate.class);
    private final AssistantRateLimiter limiter =
        new AssistantRateLimiter(redis, Clock.fixed(Instant.parse("2026-10-28T05:00:30Z"), ZoneOffset.UTC));

    @Test
    void a_redis_failure_while_counting_returns_the_slot_and_answers_503() {
        when(redis.opsForValue()).thenReturn(values);
        when(values.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);
        when(values.increment(anyString())).thenThrow(new RedisConnectionFailureException("redis down"));

        assertThatThrownBy(() -> limiter.acquire(USER))
            .isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getCode()).isEqualTo("ASSISTANT_UNAVAILABLE"));
        verify(redis).execute(any(RedisScript.class), eq(RUNNING_KEY), anyString());
    }

    @Test
    void a_redis_failure_while_releasing_does_not_throw() {
        when(redis.opsForValue()).thenReturn(values);
        when(values.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);
        when(values.increment(anyString())).thenReturn(1L);
        when(redis.execute(any(RedisScript.class), eq(RUNNING_KEY), anyString()))
            .thenThrow(new RedisConnectionFailureException("redis down"));

        AssistantRateLimiter.Lease lease = limiter.acquire(USER);

        assertThatCode(lease::close).doesNotThrowAnyException();
    }
}
