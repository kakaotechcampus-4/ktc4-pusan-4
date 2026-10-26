package com.ktc4.pusan4.user.domain;

/** GET /users/me 의 role. 프론트는 ADMIN 이면 관리자 메뉴를 보인다. */
public enum UserRole {
    USER,
    ADMIN
}
