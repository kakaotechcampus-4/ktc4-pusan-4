package com.ktc4.pusan4.auth.api;

/** @param verificationToken 가입 요청에 그대로 싣는다. 30분 동안 쓸 수 있다 */
public record EmailVerificationResponse(String verificationToken) {
}
