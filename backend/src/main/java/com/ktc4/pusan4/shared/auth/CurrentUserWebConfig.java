package com.ktc4.pusan4.shared.auth;

import com.ktc4.pusan4.shared.api.WebConfig;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class CurrentUserWebConfig implements WebMvcConfigurer {

    static {
        // CurrentUser 는 요청 파라미터가 아니라 서버가 채우는 값이라 스웨거에 노출하지 않는다.
        SpringDocUtils.getConfig().addRequestWrapperToIgnore(CurrentUser.class);
    }

    private final CurrentUserProvider provider;

    public CurrentUserWebConfig(CurrentUserProvider provider) {
        this.provider = provider;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new CurrentUserArgumentResolver(provider));
    }

    /**
     * 인증 API 를 뺀 모든 API 는 사용자를 알아야 한다(api.md 1.1). {@link CurrentUser} 인자가 없는 API(목 응답 등)도
     * 막도록 인자 리졸버가 아니라 인터셉터에서 확인한다. actuator·스웨거는 /api/v1 밖이라 걸리지 않는다.
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                provider.resolve(request);
                return true;
            }
        })
            .addPathPatterns(WebConfig.API_PREFIX + "/**")
            .excludePathPatterns(WebConfig.API_PREFIX + "/auth/**");
    }
}
