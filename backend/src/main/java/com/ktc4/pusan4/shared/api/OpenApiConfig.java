package com.ktc4.pusan4.shared.api;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
public class OpenApiConfig {

    private static final String BEARER = "bearer";
    private static final String MOCK_RESPONSE_NOTE = "[목 응답] 입력과 상관없이 고정된 값을 반환한다.";

    /**
     * 모든 API 가 낼 수 있는 공통 에러 (api.md 1.3). 400 은 API 전용 코드가 있으면 그 설명 뒤에 덧붙인다.
     */
    private static final Map<String, String> COMMON_ERRORS = Map.of(
        "400", "VALIDATION_ERROR",
        "401", "UNAUTHORIZED",
        "500", "INTERNAL_ERROR"
    );

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

                    **공통 에러 코드 (api.md 1.3)** — API 마다 적힌 전용 `code` 외의 실패는 상태 코드별로 아래 코드를 쓴다.

                    | 상태 | code | 쓰임 |
                    | --- | --- | --- |
                    | 400 | VALIDATION_ERROR | 필수 필드 누락·타입 불일치 등 문서화되지 않은 요청 검증 실패 |
                    | 401 | UNAUTHORIZED | `Authorization` 헤더 누락 |
                    | 404 | NOT_FOUND | 전용 `*_NOT_FOUND` 가 없는 경로의 리소스 없음 |
                    | 409 | CONFLICT | 전용 코드가 없는 상태 충돌 |
                    | 422 | UNPROCESSABLE_ENTITY | 전용 코드가 없는 처리 불가 |
                    | 500 | INTERNAL_ERROR | 그 외 서버 오류 |

                    단건 리소스 조회의 404 는 리소스별 전용 코드(`BATCH_NOT_FOUND` 등)를 쓴다.
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

    /**
     * 공통 에러를 모든 API 응답 목록에 붙인다. API 가 같은 상태 코드를 이미 적었으면 설명만 덧붙인다.
     */
    @Bean
    OperationCustomizer commonErrorResponses() {
        return (operation, handlerMethod) -> {
            ApiResponses responses = operation.getResponses();
            if (responses == null) {
                responses = new ApiResponses();
                operation.setResponses(responses);
            }
            COMMON_ERRORS.forEach((status, code) -> {
                ApiResponse existing = responses.get(status);
                if (existing == null) {
                    responses.addApiResponse(status, new ApiResponse().description(code).content(errorContent()));
                } else if (existing.getDescription() == null) {
                    existing.setDescription(code);
                } else if (!existing.getDescription().contains(code)) {
                    existing.setDescription(existing.getDescription() + ", " + code);
                }
            });
            return operation;
        };
    }

    private static Content errorContent() {
        return new Content().addMediaType(org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
            new MediaType().schema(new Schema<>().$ref("#/components/schemas/ErrorResponse")));
    }
}
