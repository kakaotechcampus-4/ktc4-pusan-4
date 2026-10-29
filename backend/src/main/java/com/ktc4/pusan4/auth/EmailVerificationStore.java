package com.ktc4.pusan4.auth;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;

/**
 * Redis 에 둔 메일 인증 상태. 이메일은 {@link com.ktc4.pusan4.user.domain.Emails#normalize} 를 거친 값이다.
 * <ul>
 *   <li>{@code email-verify:code:{email}} → {@code { code, attempts }}. TTL {@link #CODE_TTL}.</li>
 *   <li>{@code email-verify:cooldown:{email}} → 재발송 대기. TTL {@link #RESEND_COOLDOWN}.</li>
 *   <li>{@code email-verify:daily:{email}} → 하루 발송 횟수. 첫 발송부터 24시간.</li>
 *   <li>{@code email-verify:verified:{email}} → 인증 토큰의 SHA-256. TTL {@link #VERIFIED_TTL}.</li>
 * </ul>
 * 코드는 6자리라 해시해도 금방 풀려서 원문으로 둔다. 대신 틀린 횟수와 하루 발송 횟수로 맞혀 보기를 막는다
 * (코드 하나에 {@link #MAX_ATTEMPTS}번, 하루 {@link #DAILY_LIMIT}개).
 */
@Component
class EmailVerificationStore {

    static final Duration CODE_TTL = Duration.ofMinutes(5);
    static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    static final Duration VERIFIED_TTL = Duration.ofMinutes(30);
    static final int MAX_ATTEMPTS = 5;
    static final int DAILY_LIMIT = 10;

    private static final Duration DAY = Duration.ofDays(1);

    /** KEYS: code, cooldown, daily / ARGV: code, codeTtl(ms), cooldown(ms), day(ms), dailyLimit. 0 저장, -1 하루 한도, 양수 남은 대기(ms) */
    private static final RedisScript<Long> ISSUE = RedisScript.of("""
        local sent = tonumber(redis.call('GET', KEYS[3]) or '0')
        if sent >= tonumber(ARGV[5]) then
          return -1
        end
        if not redis.call('SET', KEYS[2], '1', 'NX', 'PX', ARGV[3]) then
          return math.max(redis.call('PTTL', KEYS[2]), 1)
        end
        if redis.call('INCR', KEYS[3]) == 1 then
          redis.call('PEXPIRE', KEYS[3], ARGV[4])
        end
        redis.call('DEL', KEYS[1])
        redis.call('HSET', KEYS[1], 'code', ARGV[1], 'attempts', 0)
        redis.call('PEXPIRE', KEYS[1], ARGV[2])
        return 0
        """, Long.class);

    /** KEYS: code, verified / ARGV: 보낸 코드, maxAttempts, tokenHash, verifiedTtl(ms). 1 인증, 0 코드 없음, -1 틀림 */
    private static final RedisScript<Long> CONFIRM = RedisScript.of("""
        local stored = redis.call('HGET', KEYS[1], 'code')
        if not stored then
          return 0
        end
        if stored ~= ARGV[1] then
          if redis.call('HINCRBY', KEYS[1], 'attempts', 1) >= tonumber(ARGV[2]) then
            redis.call('DEL', KEYS[1])
          end
          return -1
        end
        redis.call('DEL', KEYS[1])
        redis.call('SET', KEYS[2], ARGV[3], 'PX', ARGV[4])
        return 1
        """, Long.class);

    private final StringRedisTemplate redis;

    EmailVerificationStore(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /** 새 코드를 둔다. 이전 코드는 버린다. */
    IssueResult issue(String email, String code) {
        Long result = redis.execute(ISSUE, List.of(codeKey(email), cooldownKey(email), dailyKey(email)),
            code, ms(CODE_TTL), ms(RESEND_COOLDOWN), ms(DAY), Integer.toString(DAILY_LIMIT));
        long value = Objects.requireNonNull(result);
        if (value == 0) {
            return IssueResult.issued();
        }
        return value < 0 ? IssueResult.dailyLimit() : IssueResult.cooldown(Duration.ofMillis(value));
    }

    /** 메일을 못 보냈을 때. 코드와 재발송 대기를 지워 바로 다시 요청할 수 있게 한다. 하루 횟수는 그대로 센다. */
    void cancel(String email) {
        redis.delete(List.of(codeKey(email), cooldownKey(email)));
    }

    ConfirmResult confirm(String email, String code, String verificationToken) {
        Long result = redis.execute(CONFIRM, List.of(codeKey(email), verifiedKey(email)),
            code, Integer.toString(MAX_ATTEMPTS), hash(verificationToken), ms(VERIFIED_TTL));
        long value = Objects.requireNonNull(result);
        if (value == 1) {
            return ConfirmResult.VERIFIED;
        }
        return value == 0 ? ConfirmResult.NO_CODE : ConfirmResult.WRONG_CODE;
    }

    boolean isVerified(String email, String verificationToken) {
        return hash(verificationToken).equals(redis.opsForValue().get(verifiedKey(email)));
    }

    /** 가입이 끝나면 지운다. 같은 토큰으로 다시 가입할 일은 없지만 남겨 둘 이유도 없다. */
    void consumeVerified(String email) {
        redis.delete(verifiedKey(email));
    }

    private static String codeKey(String email) {
        return "email-verify:code:" + email;
    }

    private static String cooldownKey(String email) {
        return "email-verify:cooldown:" + email;
    }

    private static String dailyKey(String email) {
        return "email-verify:daily:" + email;
    }

    private static String verifiedKey(String email) {
        return "email-verify:verified:" + email;
    }

    private static String ms(Duration duration) {
        return Long.toString(duration.toMillis());
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 을 쓸 수 없다", e);
        }
    }

    enum ConfirmResult { VERIFIED, NO_CODE, WRONG_CODE }

    /** @param retryAfter 재발송 대기일 때만 값이 있다 */
    record IssueResult(Status status, Duration retryAfter) {

        enum Status { ISSUED, COOLDOWN, DAILY_LIMIT }

        static IssueResult issued() {
            return new IssueResult(Status.ISSUED, Duration.ZERO);
        }

        static IssueResult cooldown(Duration retryAfter) {
            return new IssueResult(Status.COOLDOWN, retryAfter);
        }

        static IssueResult dailyLimit() {
            return new IssueResult(Status.DAILY_LIMIT, Duration.ZERO);
        }
    }
}
