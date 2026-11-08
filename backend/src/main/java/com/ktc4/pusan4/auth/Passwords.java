package com.ktc4.pusan4.auth;

import java.nio.charset.StandardCharsets;

/** 비밀번호 길이 상한 (api.md 1.1 회원가입). 최소 길이는 SignupRequest 가 본다. */
final class Passwords {

    /** BCrypt 는 72바이트까지만 본다. 넘으면 Spring Security 가 예외를 던진다 */
    private static final int MAX_BYTES = 72;

    private Passwords() {
    }

    static boolean fitsBcrypt(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length <= MAX_BYTES;
    }
}
