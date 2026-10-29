package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.auth.EmailVerificationStore.IssueResult;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.user.domain.Emails;
import com.ktc4.pusan4.user.persistence.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Base64;

/**
 * 가입 전 메일 인증 (api.md 1.1). 코드 요청 → 메일의 6자리 코드 확인 → 받은 인증 토큰으로 가입.
 * 인증하지 않은 계정은 DB 에 생기지 않는다.
 */
@Service
public class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);

    private final EmailVerificationStore store;
    private final VerificationMailSender mailSender;
    private final UserService users;
    private final SecureRandom random = new SecureRandom();

    EmailVerificationService(EmailVerificationStore store, VerificationMailSender mailSender, UserService users) {
        this.store = store;
        this.mailSender = mailSender;
        this.users = users;
    }

    /** 인증 코드를 메일로 보낸다. 다시 보내면 이전 코드는 쓸 수 없다. */
    public void sendCode(String rawEmail) {
        String email = Emails.normalize(rawEmail);
        if (!mailSender.available()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "EMAIL_VERIFICATION_UNAVAILABLE",
                "지금은 이메일 가입을 쓸 수 없습니다.");
        }
        if (users.isEmailRegistered(email)) {
            throw AuthService.emailAlreadyExists();
        }
        String code = "%06d".formatted(random.nextInt(1_000_000));
        IssueResult issued = store.issue(email, code);
        switch (issued.status()) {
            case COOLDOWN -> throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "VERIFICATION_RESEND_TOO_SOON",
                "%d초 뒤에 다시 요청해 주세요.".formatted(Math.max(1, issued.retryAfter().toSeconds())));
            case DAILY_LIMIT -> throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "VERIFICATION_DAILY_LIMIT",
                "오늘은 인증 코드를 더 받을 수 없습니다. 내일 다시 시도해 주세요.");
            case ISSUED -> send(email, code);
        }
    }

    /** 코드가 맞으면 가입에 쓸 인증 토큰을 준다. */
    public String confirm(String rawEmail, String code) {
        String email = Emails.normalize(rawEmail);
        String token = newToken();
        return switch (store.confirm(email, code, token)) {
            case VERIFIED -> token;
            case WRONG_CODE -> throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_VERIFICATION_CODE",
                "인증 코드가 맞지 않습니다.");
            case NO_CODE -> throw new ApiException(HttpStatus.BAD_REQUEST, "VERIFICATION_CODE_EXPIRED",
                "인증 코드가 만료됐습니다. 코드를 다시 받아 주세요.");
        };
    }

    /** 가입 직전에 본다. 이 이메일을 인증하고 받은 토큰이 아니면 400 이다. */
    void requireVerified(String rawEmail, String verificationToken) {
        if (!store.isVerified(Emails.normalize(rawEmail), verificationToken)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EMAIL_NOT_VERIFIED",
                "이메일 인증을 먼저 해 주세요.");
        }
    }

    void consume(String rawEmail) {
        store.consumeVerified(Emails.normalize(rawEmail));
    }

    private void send(String email, String code) {
        try {
            mailSender.send(email, code);
        } catch (MailException e) {
            store.cancel(email);
            log.warn("인증 메일을 보내지 못했다: {}", e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "EMAIL_SEND_FAILED",
                "인증 메일을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
        }
    }

    private String newToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
