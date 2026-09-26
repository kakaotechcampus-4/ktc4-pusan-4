package com.ktc4.pusan4.shared.api;

import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String BEARER = "bearer";

    @Bean
    OpenAPI openApi() {
        return new OpenAPI()
            .info(new Info()
                .title("판정 시스템 API")
                .version("v1")
                .description("""
                    계약 원본은 repo 의 `docs/api.md` 다 (현재 기준: PR #41 의 ce91429). 설명에 붙은 절 번호(예: 3.9)는 api.md 기준이다.
                    이 문서는 요청·응답 형태와 에러 코드를 보여 주고, 동작 규칙과 흐름
                    (재판정, 상태 전이, 사용자 흐름)은 api.md 를 따른다.

                    구현되지 않은 API 는 `501 NOT_IMPLEMENTED` 를 반환한다.
                    """))
            .addSecurityItem(new SecurityRequirement().addList(BEARER))
            .components(new Components()
                .addSecuritySchemes(BEARER, new SecurityScheme()
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")));
    }

    /**
     * 모든 API 에 501 응답을 붙인다. 구현이 들어오면 이 커스터마이저를 지운다.
     */
    @Bean
    OpenApiCustomizer notImplementedResponse() {
        return openApi -> {
            ModelConverters.getInstance().read(ErrorResponse.class)
                .forEach(openApi.getComponents()::addSchemas);
            ApiResponse notImplemented = new ApiResponse()
                .description("NOT_IMPLEMENTED — 아직 구현되지 않음")
                .content(new Content().addMediaType("application/json",
                    new MediaType().schema(new Schema<>().$ref("#/components/schemas/ErrorResponse"))));
            openApi.getPaths().values().forEach(path ->
                path.readOperations().forEach(operation ->
                    operation.getResponses().addApiResponse("501", notImplemented)));
        };
    }
}
