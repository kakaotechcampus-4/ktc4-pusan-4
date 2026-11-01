package com.ktc4.pusan4.auth;

import com.nimbusds.jose.JOSEException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

@Configuration
class AuthConfiguration {

    private static final Logger log = LoggerFactory.getLogger(AuthConfiguration.class);
    private static final int MIN_SECRET_BYTES = 32;

    /**
     * 서명 키. 비어 있으면 기동할 때마다 새 키를 만든다 — 열려 있지는 않고, 재기동하면 로그인이 모두 풀릴 뿐이다.
     * 테스트와 키를 아직 안 넣은 서버가 이 경우다. 넣었는데 짧으면 HS256 이 요구하는 길이가 안 돼 기동을 멈춘다.
     */
    @Bean
    SignedTokens signedTokens(@Value("${app.auth.jwt-secret}") String secret) throws JOSEException {
        if (secret.isBlank()) {
            log.warn("APP_AUTH_JWT_SECRET 이 없어 임시 서명 키를 만들었다. 재기동하면 로그인이 모두 풀린다");
            byte[] random = new byte[MIN_SECRET_BYTES];
            new SecureRandom().nextBytes(random);
            return new SignedTokens(random);
        }
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < MIN_SECRET_BYTES) {
            throw new IllegalStateException("APP_AUTH_JWT_SECRET 은 32바이트 이상이어야 한다 (openssl rand -hex 32)");
        }
        return new SignedTokens(bytes);
    }
}
