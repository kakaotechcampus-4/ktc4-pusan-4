package com.ktc4.pusan4.auth;

/** 인증 코드 메일. 운영은 SMTP, 로컬은 로그로 보낸다({@code app.auth.email-verification.delivery}). */
interface VerificationMailSender {

    /** 메일을 보낼 설정이 있는지. 없으면 인증 요청이 503 이다. */
    boolean available();

    /** @throws org.springframework.mail.MailException 보내지 못했을 때 */
    void send(String email, String code);
}
