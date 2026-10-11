package com.ktc4.pusan4.shared.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/**
 * 컨트롤러 메서드의 {@link CurrentUser} 인자를 {@link CurrentUserProvider} 로 채운다.
 */
class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

    private final CurrentUserProvider provider;

    CurrentUserArgumentResolver(CurrentUserProvider provider) {
        this.provider = provider;
    }

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return CurrentUser.class.equals(parameter.getParameterType());
    }

    @Override
    public CurrentUser resolveArgument(
        MethodParameter parameter,
        ModelAndViewContainer mavContainer,
        NativeWebRequest webRequest,
        WebDataBinderFactory binderFactory
    ) {
        return provider.resolve(webRequest.getNativeRequest(HttpServletRequest.class));
    }
}
