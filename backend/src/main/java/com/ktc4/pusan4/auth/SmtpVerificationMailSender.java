package com.ktc4.pusan4.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/** SMTP(지금은 팀 Gmail 계정 + 앱 비밀번호)로 보낸다. 계정이 비면 보내지 않는다. */
@Component
@ConditionalOnProperty(name = "app.auth.email-verification.delivery", havingValue = "smtp", matchIfMissing = true)
class SmtpVerificationMailSender implements VerificationMailSender {

    private final JavaMailSender mailSender;
    private final String from;

    SmtpVerificationMailSender(JavaMailSender mailSender, @Value("${spring.mail.username:}") String from) {
        this.mailSender = mailSender;
        this.from = from;
    }

    @Override
    public boolean available() {
        return !from.isBlank();
    }

    @Override
    public void send(String email, String code) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject("[PreeT] 이메일 인증 코드");
        message.setText("""
            인증 코드: %s

            %d분 안에 가입 화면에 입력해 주세요.
            직접 요청하지 않았다면 이 메일은 무시하셔도 됩니다.
            """.formatted(code, EmailVerificationStore.CODE_TTL.toMinutes()));
        mailSender.send(message);
    }
}
