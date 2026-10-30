package com.ktc4.pusan4.user.persistence;

import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.user.domain.AppUser;
import com.ktc4.pusan4.user.domain.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * 관리자 판별. app_user.role(V17)이 ADMIN 인 사용자가 관리자다.
 * 인증(누구인가)은 Bearer 토큰이, 인가(무엇을 할 수 있나)는 여기서 본다.
 */
@Component
public class AdminPolicy {

    private final UserService userService;

    AdminPolicy(UserService userService) {
        this.userService = userService;
    }

    /** 관리자면 그 사용자를, 아니면 403 FORBIDDEN 을 던진다. */
    public AppUser requireAdmin(UUID userId) {
        AppUser user = userService.get(userId);
        if (user.role() != UserRole.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "관리자만 할 수 있습니다.");
        }
        return user;
    }
}
