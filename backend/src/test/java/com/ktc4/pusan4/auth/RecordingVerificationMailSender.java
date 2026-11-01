package com.ktc4.pusan4.auth;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.mail.MailSendException;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 메일을 보내지 않고 이메일별 마지막 코드를 기억한다. 가입 흐름을 보는 통합 테스트에 {@code @Import} 로 붙인다.
 * {@link #failNext} 를 켜면 다음 한 번은 발송 실패다.
 */
public class RecordingVerificationMailSender implements VerificationMailSender {

    private final Map<String, String> lastCodes = new ConcurrentHashMap<>();
    private volatile boolean failNextSend;

    @Override
    public boolean available() {
        return true;
    }

    @Override
    public void send(String email, String code) {
        if (failNextSend) {
            failNextSend = false;
            throw new MailSendException("테스트용 발송 실패");
        }
        lastCodes.put(email, code);
    }

    public Optional<String> lastCode(String email) {
        return Optional.ofNullable(lastCodes.get(email));
    }

    public void failNext() {
        failNextSend = true;
    }

    @TestConfiguration(proxyBeanMethods = false)
    public static class Config {

        @Bean
        @Primary
        RecordingVerificationMailSender recordingVerificationMailSender() {
            return new RecordingVerificationMailSender();
        }
    }
}
