package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.shared.api.ApiException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PasswordsTest {

    @ParameterizedTest
    @ValueSource(strings = {
        "abcdef1!",          // 딱 8자
        "password-2026",     // 소문자만, 대문자는 필수가 아니다
        "Pass word 1!",      // 공백도 그대로 받는다
        "비밀번호abc1!",       // 한글이 섞여도 세 종류가 있으면 된다
        "~`a1~~~~",          // ASCII 기호 끝자락
    })
    void accepts_letters_digits_and_symbols(String password) {
        assertThatCode(() -> Passwords.requireValid(password)).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "abcdefg1",          // 기호 없음
        "abcdefg!",          // 숫자 없음
        "12345678!",         // 영문 없음
        "비밀번호12!@",        // 한글은 영문으로 치지 않는다
        "abcd1234 ",         // 공백은 기호가 아니다
        "abc1!",             // 7자 미만
        "ab1!ab1",           // 7자
    })
    void rejects_password_missing_a_kind_or_too_short(String password) {
        assertThatThrownBy(() -> Passwords.requireValid(password))
            .isInstanceOfSatisfying(ApiException.class, error -> {
                assertThat(error.getCode()).isEqualTo("VALIDATION_ERROR");
                assertThat(error.getMessage()).contains("영문, 숫자, 기호");
            });
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "pw1!가나다라마바사아자차카타파하가나다라마바사아자차",  // 4 + 24×3 = 76바이트
        "abcdefghij1!abcdefghij1!abcdefghij1!abcdefghij1!abcdefghij1!abcdefghij1!a",  // 73바이트
    })
    void rejects_password_over_bcrypt_limit(String password) {
        assertThatThrownBy(() -> Passwords.requireValid(password))
            .isInstanceOfSatisfying(ApiException.class, error ->
                assertThat(error.getMessage()).contains("72바이트"));
    }
}
