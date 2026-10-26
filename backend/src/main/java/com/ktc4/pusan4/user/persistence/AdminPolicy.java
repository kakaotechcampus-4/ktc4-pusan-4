package com.ktc4.pusan4.user.persistence;

import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.user.domain.AppUser;
import com.ktc4.pusan4.user.domain.UserRole;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 관리자 판별. 지금은 설정(app.admin.emails)의 이메일 목록으로 정한다.
 * 계정 방식(B9b)이 정해져 app_user 에 role 을 두게 되면 이 클래스 안만 바꾼다 — 호출하는 쪽은 그대로다.
 */
@Component
public class AdminPolicy {

    private final UserService userService;
    private final Set<String> adminEmails;

    AdminPolicy(UserService userService, @Value("${app.admin.emails:}") String adminEmails) {
        this.userService = userService;
        this.adminEmails = Arrays.stream(adminEmails.split(","))
            .map(email -> email.trim().toLowerCase(Locale.ROOT))
            .filter(email -> !email.isEmpty())
            .collect(Collectors.toUnmodifiableSet());
    }

    /** 이메일이 없는 계정(카카오 로그인, B9b)은 관리자가 될 수 없다. */
    public UserRole roleOf(AppUser user) {
        boolean admin = user.email() != null && adminEmails.contains(user.email().toLowerCase(Locale.ROOT));
        return admin ? UserRole.ADMIN : UserRole.USER;
    }

    /** 관리자면 그 사용자를, 아니면 403 FORBIDDEN 을 던진다. */
    public AppUser requireAdmin(UUID userId) {
        AppUser user = userService.get(userId);
        if (roleOf(user) != UserRole.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "관리자만 할 수 있습니다.");
        }
        return user;
    }
}
