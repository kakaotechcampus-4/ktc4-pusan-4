package com.ktc4.pusan4.shared.auth;

import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
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
}
