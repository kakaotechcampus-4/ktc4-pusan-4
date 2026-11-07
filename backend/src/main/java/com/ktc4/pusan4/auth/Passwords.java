package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.shared.api.ApiException;
import org.springframework.http.HttpStatus;

import java.nio.charset.StandardCharsets;

/**
 * 비밀번호 규칙 (api.md 1.1 회원가입). 새 비밀번호를 정하는 곳(지금은 가입)은 {@link #requireValid} 를 거친다.
 * 로그인은 이미 정한 비밀번호라 규칙을 보지 않는다. 규칙이 생기기 전에 가입한 사용자도 그대로 로그인한다.
 */
final class Passwords {

    private static final int MIN_LENGTH = 8;

    /** BCrypt 는 72바이트까지만 본다. 넘으면 Spring Security 가 예외를 던진다 */
    private static final int MAX_BYTES = 72;

    private static final String RULE = "비밀번호는 영문, 숫자, 기호를 모두 넣어 8자 이상으로 입력해 주세요.";

    private Passwords() {
    }

    static boolean fitsBcrypt(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length <= MAX_BYTES;
    }

    /**
     * 영문자, 숫자, 기호를 하나씩 넣은 8자 이상, 72바이트 이하. 기호는 영문자와 숫자가 아닌 ASCII 문자(공백 제외)다.
     * 공백과 한글은 막지 않지만 어느 종류로도 세지 않는다. 대문자는 필수가 아니다.
     * 입력 검증 오류는 공통 처리기가 문구를 하나로 바꾸므로, 이유를 알리려고 여기서 던진다.
     */
    static void requireValid(String password) {
        if (!fitsBcrypt(password)) {
            throw invalid("비밀번호는 72바이트를 넘을 수 없습니다. 한글은 24자, 영문은 72자까지 쓸 수 있습니다.");
        }
        if (password.codePointCount(0, password.length()) < MIN_LENGTH
            || !password.chars().anyMatch(Passwords::isAsciiLetter)
            || !password.chars().anyMatch(Passwords::isAsciiDigit)
            || !password.chars().anyMatch(Passwords::isAsciiSymbol)) {
            throw invalid(RULE);
        }
    }

    private static boolean isAsciiLetter(int c) {
        return c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z';
    }

    private static boolean isAsciiDigit(int c) {
        return c >= '0' && c <= '9';
    }

    /** '!'(0x21)부터 '~'(0x7E)까지에서 영문자와 숫자를 뺀 것 */
    private static boolean isAsciiSymbol(int c) {
        return c >= '!' && c <= '~' && !isAsciiLetter(c) && !isAsciiDigit(c);
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message);
    }
}
