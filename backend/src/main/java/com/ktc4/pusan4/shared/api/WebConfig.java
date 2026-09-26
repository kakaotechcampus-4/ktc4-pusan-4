package com.ktc4.pusan4.shared.api;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.HandlerTypePredicate;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    public static final String API_PREFIX = "/api/v1";

    /**
     * 우리 패키지의 컨트롤러에만 /api/v1 을 붙인다.
     *
     * <p>{@code forAnnotation(RestController.class)} 로 걸면 springdoc 의 /v3/api-docs 컨트롤러도
     * {@code @RestController} 라서 함께 밀려난다. actuator(/actuator/health)도 그대로 둔다.
     */
    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        configurer.addPathPrefix(API_PREFIX, HandlerTypePredicate.forBasePackage("com.ktc4.pusan4"));
    }
}
