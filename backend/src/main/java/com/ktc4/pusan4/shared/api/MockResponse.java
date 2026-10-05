package com.ktc4.pusan4.shared.api;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 서비스 레이어가 붙기 전이라 *MockData 의 고정 응답을 반환하는 API 에 붙인다.
 * 스웨거 설명 앞에 목 응답 표시가 붙는다({@link OpenApiConfig}). 서비스로 바꾸면 이 어노테이션도 지운다.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface MockResponse {
}
