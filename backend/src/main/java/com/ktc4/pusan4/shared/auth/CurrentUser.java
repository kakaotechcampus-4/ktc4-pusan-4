package com.ktc4.pusan4.shared.auth;

import java.util.UUID;

/**
 * 요청을 보낸 사용자. 컨트롤러 메서드 인자로 받으면 {@link CurrentUserArgumentResolver} 가 채운다.
 * 서비스는 userId 를 요청 본문이나 경로가 아니라 여기서만 받는다.
 */
public record CurrentUser(UUID id) {
}
