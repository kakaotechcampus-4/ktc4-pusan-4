package com.ktc4.pusan4.shared.auth;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 요청에서 사용자를 알아낸다. 구현체는 {@code auth.BearerCurrentUserProvider}(Authorization 의 액세스 토큰)다.
 * 사용자를 알 수 없으면 401 UNAUTHORIZED 를 던진다. 컨트롤러·서비스는 구현체를 모른다.
 */
public interface CurrentUserProvider {

    CurrentUser resolve(HttpServletRequest request);
}
