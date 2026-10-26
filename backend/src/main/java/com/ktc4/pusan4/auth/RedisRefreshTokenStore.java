package com.ktc4.pusan4.auth;

import com.nimbusds.jwt.JWTClaimsSet;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Redis 에 둔 리프레시 토큰 (docs/backend_api_plan.md "저장소 결정").
 *
 * <p>로그인 한 번이 family 하나다. 토큰은 userId 와 familyId(fid)를 담은 JWT 이고, Redis 에는 원문이 아니라 해시만 둔다.
 * <ul>
 *   <li>{@code refresh:{familyId}} → {@code { userId, tokenHash }}. TTL 은 리프레시 토큰 수명이다.</li>
 *   <li>{@code user:{userId}:families} → 그 사용자의 familyId Set. 탈퇴 때 한 번에 지우는 데 쓴다.</li>
 * </ul>
 * 재발급은 저장된 해시와 보낸 토큰이 같을 때만 새 해시로 바꾼다. 다르면 이미 쓴 토큰을 다시 쓴 것으로 보고 그 family 를 지운다
 * (그 기기만 로그아웃). 확인과 교체 사이에 다른 요청이 끼지 않도록 Lua 스크립트 하나로 한다.
 */
@Component
class RedisRefreshTokenStore implements RefreshTokenStore {

    static final String TYPE = "refresh";
    static final String FAMILY_CLAIM = "fid";

    private static final String FAMILY_KEY = "refresh:";

    /** KEYS: family, 사용자 Set / ARGV: userId, tokenHash, ttl(ms), familyId */
    private static final RedisScript<Long> ISSUE = RedisScript.of("""
        redis.call('HSET', KEYS[1], 'userId', ARGV[1], 'tokenHash', ARGV[2])
        redis.call('PEXPIRE', KEYS[1], ARGV[3])
        redis.call('SADD', KEYS[2], ARGV[4])
        redis.call('PEXPIRE', KEYS[2], ARGV[3])
        return 1
        """, Long.class);

    /** KEYS: family, 사용자 Set / ARGV: 보낸 토큰 해시, 새 토큰 해시, ttl(ms), familyId. 1 교체, 0 없음, -1 재사용 */
    private static final RedisScript<Long> ROTATE = RedisScript.of("""
        local stored = redis.call('HGET', KEYS[1], 'tokenHash')
        if not stored then
          return 0
        end
        if stored ~= ARGV[1] then
          redis.call('DEL', KEYS[1])
          redis.call('SREM', KEYS[2], ARGV[4])
          return -1
        end
        redis.call('HSET', KEYS[1], 'tokenHash', ARGV[2])
        redis.call('PEXPIRE', KEYS[1], ARGV[3])
        redis.call('PEXPIRE', KEYS[2], ARGV[3])
        return 1
        """, Long.class);

    /** KEYS: family, 사용자 Set / ARGV: familyId */
    private static final RedisScript<Long> REVOKE = RedisScript.of("""
        redis.call('SREM', KEYS[2], ARGV[1])
        return redis.call('DEL', KEYS[1])
        """, Long.class);

    /** KEYS: 사용자 Set / ARGV: family 키 접두사 */
    private static final RedisScript<Long> REVOKE_ALL = RedisScript.of("""
        local families = redis.call('SMEMBERS', KEYS[1])
        for _, family in ipairs(families) do
          redis.call('DEL', ARGV[1] .. family)
        end
        redis.call('DEL', KEYS[1])
        return #families
        """, Long.class);

    private final StringRedisTemplate redis;
    private final SignedTokens tokens;
    private final Clock clock;
    private final Duration ttl;

    RedisRefreshTokenStore(StringRedisTemplate redis, SignedTokens tokens, Clock clock,
        @Value("${app.auth.refresh-token-ttl}") Duration ttl) {
        this.redis = redis;
        this.tokens = tokens;
        this.clock = clock;
        this.ttl = ttl;
    }

    @Override
    public RefreshToken issue(UUID userId) {
        UUID familyId = UUID.randomUUID();
        String token = sign(userId, familyId);
        redis.execute(ISSUE, keys(userId, familyId),
            userId.toString(), hash(token), Long.toString(ttl.toMillis()), familyId.toString());
        return new RefreshToken(token, ttl);
    }

    @Override
    public Optional<Rotation> rotate(String token) {
        return verified(token).flatMap(family -> {
            String next = sign(family.userId(), family.familyId());
            Long result = redis.execute(ROTATE, keys(family.userId(), family.familyId()),
                hash(token), hash(next), Long.toString(ttl.toMillis()), family.familyId().toString());
            return Long.valueOf(1).equals(result)
                ? Optional.of(new Rotation(family.userId(), new RefreshToken(next, ttl)))
                : Optional.empty();
        });
    }

    @Override
    public void revoke(String token) {
        verified(token).ifPresent(family ->
            redis.execute(REVOKE, keys(family.userId(), family.familyId()), family.familyId().toString()));
    }

    @Override
    public void revokeAll(UUID userId) {
        redis.execute(REVOKE_ALL, List.of(familiesKey(userId)), FAMILY_KEY);
    }

    private String sign(UUID userId, UUID familyId) {
        Instant now = clock.instant();
        return tokens.issue(userId, TYPE, now, now.plus(ttl), Map.of(FAMILY_CLAIM, familyId.toString()));
    }

    /** 서명·종류·만료를 통과하고 familyId 가 있는 토큰만. 저장소가 없던 때(#155) 발급한 토큰은 fid 가 없어 여기서 걸러진다. */
    private Optional<Family> verified(String token) {
        return tokens.verifyClaims(token, TYPE, clock.instant()).flatMap(RedisRefreshTokenStore::family);
    }

    private static Optional<Family> family(JWTClaimsSet claims) {
        try {
            Object familyId = claims.getClaim(FAMILY_CLAIM);
            if (!(familyId instanceof String value)) {
                return Optional.empty();
            }
            return Optional.of(new Family(UUID.fromString(claims.getSubject()), UUID.fromString(value)));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static List<String> keys(UUID userId, UUID familyId) {
        return List.of(FAMILY_KEY + familyId, familiesKey(userId));
    }

    private static String familiesKey(UUID userId) {
        return "user:" + userId + ":families";
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 을 쓸 수 없다", e);
        }
    }

    private record Family(UUID userId, UUID familyId) {
    }
}
