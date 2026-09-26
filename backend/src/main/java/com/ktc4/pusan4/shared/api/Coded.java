package com.ktc4.pusan4.shared.api;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 상태값 표현 (api.md 1.5). 분기는 {@code code}, 화면 표시는 {@code label} 을 쓴다.
 *
 * <p>label 은 API 레이어가 붙인다. 도메인 enum(Verdict 등)은 화면 문구를 모른다.
 */
@Schema(description = "상태값. 분기는 code, 화면 표시는 label 을 사용한다 (api.md 1.5)")
public record Coded<E extends Enum<E>>(E code, String label) {
}
