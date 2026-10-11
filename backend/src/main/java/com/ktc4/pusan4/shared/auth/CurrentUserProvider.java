package com.ktc4.pusan4.shared.auth;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 요청에서 사용자를 알아낸다. 인증 도입 전에는 {@link TemporaryCurrentUserProvider} 가 고정 사용자를 돌려주고,
 * 인증 도입(B9b) 때 이 구현체만 Bearer 토큰 검증으로 바꾼다. 컨트롤러·서비스는 바뀌지 않는다.
 */
public interface CurrentUserProvider {

    CurrentUser resolve(HttpServletRequest request);
}
