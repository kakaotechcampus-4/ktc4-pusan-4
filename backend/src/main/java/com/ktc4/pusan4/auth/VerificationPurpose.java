package com.ktc4.pusan4.auth;

/**
 * 메일 인증 코드의 용도. 용도마다 Redis 키가 달라 가입 코드로 비밀번호를 바꾸거나 그 반대로 쓸 수 없다.
 * 대기, 하루 횟수, 시도 횟수도 용도마다 따로 센다.
 *
 * @param keyPrefix  Redis 키 앞부분. 가입은 용도가 생기기 전 키를 그대로 써서 배포 중 받은 코드가 이어진다
 * @param mailSubject 메일 제목
 * @param screen      메일 본문의 「~에 입력해 주세요」
 */
public enum VerificationPurpose {

    SIGNUP("email-verify", "[PreeT] 이메일 인증 코드", "가입 화면"),
    PASSWORD_RESET("password-reset", "[PreeT] 비밀번호 재설정 코드", "비밀번호 재설정 화면");

    private final String keyPrefix;
    private final String mailSubject;
    private final String screen;

    VerificationPurpose(String keyPrefix, String mailSubject, String screen) {
        this.keyPrefix = keyPrefix;
        this.mailSubject = mailSubject;
        this.screen = screen;
    }

    String keyPrefix() {
        return keyPrefix;
    }

    String mailSubject() {
        return mailSubject;
    }

    String screen() {
        return screen;
    }
}
