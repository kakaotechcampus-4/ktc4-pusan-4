package com.ktc4.pusan4.auth;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

import java.text.ParseException;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

/**
 * HS256 으로 서명한 JWT. 액세스 토큰과 (저장소 없는) 리프레시 토큰이 같이 쓴다.
 * {@code typ} 클레임으로 둘을 가른다 — 리프레시 토큰을 Authorization 에 실어도 통과하지 않는다.
 *
 * <p>만료는 nimbus 의 시스템 시각 검사 대신 넘겨받은 시각으로 직접 본다. 테스트가 시계를 고정할 수 있게 하기 위해서다.
 */
class SignedTokens {

    private static final String TYPE = "typ";

    private final MACSigner signer;
    private final MACVerifier verifier;

    /** @param secret 32바이트 이상. 짧으면 nimbus 가 KeyLengthException 을 던진다 */
    SignedTokens(byte[] secret) throws JOSEException {
        this.signer = new MACSigner(secret);
        this.verifier = new MACVerifier(secret);
    }

    String issue(UUID subject, String type, Instant now, Instant expiresAt) {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
            .subject(subject.toString())
            .claim(TYPE, type)
            .jwtID(UUID.randomUUID().toString())
            .issueTime(Date.from(now))
            .expirationTime(Date.from(expiresAt))
            .build();
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        try {
            jwt.sign(signer);
        } catch (JOSEException e) {
            throw new IllegalStateException("토큰 서명에 실패했다", e);
        }
        return jwt.serialize();
    }

    /** 서명·종류·만료가 모두 맞으면 subject. 하나라도 어긋나면 이유와 상관없이 empty 다. */
    Optional<UUID> verify(String token, String type, Instant now) {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            if (!JWSAlgorithm.HS256.equals(jwt.getHeader().getAlgorithm()) || !jwt.verify(verifier)) {
                return Optional.empty();
            }
            JWTClaimsSet claims = jwt.getJWTClaimsSet();
            Date expiresAt = claims.getExpirationTime();
            if (!type.equals(claims.getClaim(TYPE)) || expiresAt == null || !now.isBefore(expiresAt.toInstant())
                || claims.getSubject() == null) {
                return Optional.empty();
            }
            return Optional.of(UUID.fromString(claims.getSubject()));
        } catch (ParseException | JOSEException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
