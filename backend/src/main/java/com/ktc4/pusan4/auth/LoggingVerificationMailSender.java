package com.ktc4.pusan4.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** 로컬 개발용. 메일 대신 백엔드 로그에 코드를 찍는다. 운영에서 켜면 로그를 보는 누구나 가입할 수 있어 쓰지 않는다. */
@Component
@ConditionalOnProperty(name = "app.auth.email-verification.delivery", havingValue = "log")
class LoggingVerificationMailSender implements VerificationMailSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingVerificationMailSender.class);

    @Override
    public boolean available() {
        return true;
    }

    @Override
    public void send(String email, String code) {
        log.info("[메일 인증] {} 의 인증 코드: {}", email, code);
    }
}
