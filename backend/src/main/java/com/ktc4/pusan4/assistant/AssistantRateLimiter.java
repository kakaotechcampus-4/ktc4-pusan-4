package com.ktc4.pusan4.assistant;

import com.ktc4.pusan4.shared.api.ApiException;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 비서 사용자별 한도 (api.md 3.14, agent-secretary.md 5장 호출 한도): 동시 1턴, 분당 10턴, 하루(한국 시각) 100턴.
 * 비용보다 남용·폭주 루프를 막는 것이 목적이다. 서버가 여러 대여도 같은 값을 보도록 Redis 에 센다.
 */
@Component
public class AssistantRateLimiter {

    static final int PER_MINUTE = 10;
    static final int PER_DAY = 100;
    // 중계 타임아웃(40초)보다 길게 둔다. 요청이 끝나면 지우고, 서버가 죽어 못 지워도 이 시간이 지나면 풀린다.
    private static final Duration RUNNING_TTL = Duration.ofSeconds(60);
    // 한 턴이 3~5초다. 동시 실행에 걸리면 이만큼 뒤에 다시 보내게 한다.
    private static final long BUSY_RETRY_SECONDS = 5;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    // 내가 잡은 자리일 때만 지운다. TTL 이 지나 다른 요청이 잡은 자리를 지우지 않는다.
    private static final RedisScript<Long> RELEASE = RedisScript.of("""
        if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end
        """, Long.class);

    private final StringRedisTemplate redis;
    private final Clock clock;

    public AssistantRateLimiter(StringRedisTemplate redis, Clock clock) {
        this.redis = redis;
        this.clock = clock;
    }

    /** 턴 하나의 자리. 끝나면 close 한다. */
    public interface Lease extends AutoCloseable {
        @Override
        void close();
    }

    /**
     * 한도를 넘으면 429 ASSISTANT_RATE_LIMITED, Redis 에 닿지 못하면 503 ASSISTANT_UNAVAILABLE.
     * 돌려준 자리는 close 해도 예외를 던지지 않는다. 지우지 못한 자리는 TTL 이 지나면 풀린다.
     */
    public Lease acquire(UUID userId) {
        try {
            return acquireOrThrow(userId);
        } catch (DataAccessException e) {
            throw AssistantErrors.unavailable();
        }
    }

    private Lease acquireOrThrow(UUID userId) {
        Instant now = clock.instant();
        String runningKey = "assistant:running:" + userId;
        String token = UUID.randomUUID().toString();
        if (!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(runningKey, token, RUNNING_TTL))) {
            throw limited(BUSY_RETRY_SECONDS);
        }
        Lease lease = () -> release(runningKey, token);
        try {
            checkCounts(userId, now);
        } catch (RuntimeException e) {
            // 한도에 걸렸거나 세다 Redis 오류가 나면 자리를 돌려준다. Redis 오류 때 그대로 두면 Redis 가 돌아와도
            // TTL 동안 동시 실행으로 막힌다.
            lease.close();
            throw e;
        }
        return lease;
    }

    private void checkCounts(UUID userId, Instant now) {
        // 동시 실행에 막힌 요청은 세지 않도록 자리를 잡은 뒤에 센다.
        ZonedDateTime kst = now.atZone(KST);
        if (count("assistant:minute:" + userId + ":" + now.getEpochSecond() / 60, Duration.ofMinutes(2)) > PER_MINUTE) {
            throw limited(60 - now.getEpochSecond() % 60);
        }
        if (count("assistant:day:" + userId + ":" + kst.toLocalDate(), Duration.ofDays(2)) > PER_DAY) {
            LocalDate tomorrow = kst.toLocalDate().plusDays(1);
            throw limited(Duration.between(now, tomorrow.atStartOfDay(KST).toInstant()).toSeconds());
        }
    }

    // 받은 답을 Redis 오류로 버리지 않는다. 지우지 못한 자리는 TTL 이 지나면 풀린다.
    private void release(String runningKey, String token) {
        try {
            redis.execute(RELEASE, List.of(runningKey), token);
        } catch (DataAccessException e) {
            // 무시한다
        }
    }

    private long count(String key, Duration ttl) {
        Long count = redis.opsForValue().increment(key);
        if (count != null && count == 1) {
            redis.expire(key, ttl);
        }
        return count == null ? 0 : count;
    }

    private static ApiException limited(long retryAfterSeconds) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.RETRY_AFTER, String.valueOf(retryAfterSeconds));
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "ASSISTANT_RATE_LIMITED",
            "비서 사용 한도에 걸렸습니다. 잠시 뒤 다시 시도해 주세요.", headers);
    }

    static ApiException limitedByAssistantServer(String retryAfter) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.RETRY_AFTER, retryAfter == null ? String.valueOf(BUSY_RETRY_SECONDS) : retryAfter);
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "ASSISTANT_RATE_LIMITED",
            "비서가 바쁩니다. 잠시 뒤 다시 시도해 주세요.", headers);
    }
}
