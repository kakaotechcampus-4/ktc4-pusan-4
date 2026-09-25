package com.ktc4.pusan4.shared.api;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String BEARER = "bearer";
    private static final String MOCK_RESPONSE_NOTE = "[목 응답] 입력과 상관없이 고정된 값을 반환한다.";

    @Bean
    OpenAPI openApi() {
        return new OpenAPI()
            .info(new Info()
                .title("판정 시스템 API")
                .version("v1")
                .description("""
                    계약 원본은 repo 의 `docs/api.md` 다. 설명에 붙은 절 번호(예: 3.9)는 api.md 기준이다.
                    이 문서는 요청·응답 형태와 에러 코드를 보여 주고, 동작 규칙과 흐름
                    (재판정, 상태 전이, 사용자 흐름)은 api.md 를 따른다.

                    설명이 `[목 응답]` 으로 시작하는 API 는 서비스가 구현되기 전이라 고정된 값을 반환한다.
                    """))
            .addSecurityItem(new SecurityRequirement().addList(BEARER))
            .components(new Components()
                .addSecuritySchemes(BEARER, new SecurityScheme()
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")));
    }

    /**
     * {@link MockResponse} 가 붙은 API 의 설명 앞에 목 응답 표시를 붙인다.
     */
    @Bean
    OperationCustomizer mockResponseNote() {
        return (operation, handlerMethod) -> {
            if (handlerMethod.hasMethodAnnotation(MockResponse.class)) {
                String description = operation.getDescription();
                operation.setDescription(
                    description == null ? MOCK_RESPONSE_NOTE : MOCK_RESPONSE_NOTE + " " + description);
            }
            return operation;
        };
    }
}
