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
        "~`a1~~~~",          // ASCII 기호 끝자락
        "abcdefghij1!abcdefghij1!abcdefghij1!abcdefghij1!abcdefghij1!abcdefghij1!",  // 딱 72자
    })
    void accepts_letters_digits_and_symbols(String password) {
        assertThatCode(() -> Passwords.requireValid(password)).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "abcdefg1",          // 기호 없음
        "abcdefg!",          // 숫자 없음
        "12345678!",         // 영문 없음
        "abc1!",             // 7자 미만
        "ab1!ab1",           // 7자
        "abcdefghij1!abcdefghij1!abcdefghij1!abcdefghij1!abcdefghij1!abcdefghij1!a",  // 73자
    })
    void rejects_password_missing_a_kind_or_out_of_length(String password) {
        assertThatThrownBy(() -> Passwords.requireValid(password))
            .isInstanceOfSatisfying(ApiException.class, error -> {
                assertThat(error.getCode()).isEqualTo("VALIDATION_ERROR");
                assertThat(error.getMessage()).contains("영문, 숫자, 기호를 모두 넣어 8자 이상 72자 이하");
            });
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "Pass word 1!",      // 가운데 공백
        "password1! ",       // 끝 공백
        "pass	word1!",      // 탭
        "비밀번호abc1!",       // 한글
        "passwörd1!",        // ASCII 밖 문자
        "password1!😀",      // 이모지
    })
    void rejects_space_and_non_ascii(String password) {
        assertThatThrownBy(() -> Passwords.requireValid(password))
            .isInstanceOfSatisfying(ApiException.class, error -> {
                assertThat(error.getCode()).isEqualTo("VALIDATION_ERROR");
                assertThat(error.getMessage()).contains("공백이나 한글");
            });
    }
}
