package com.ktc4.pusan4.user.domain;

import java.util.Locale;

/** 이메일 비교 규칙(api.md 1.1). 가입·로그인·메일 인증이 같은 규칙으로 이메일을 맞춘다. */
public final class Emails {

    private Emails() {
    }

    /** 앞뒤 공백을 빼고 소문자로 바꾼다. */
    public static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
