package com.ktc4.pusan4.user.persistence;

import com.ktc4.pusan4.user.domain.AppUser;
import com.ktc4.pusan4.user.domain.UserRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "app_user")
class AppUserEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String email;

    /** 기본 USER(DB default). 관리자는 운영 절차로 바꾼다 — 앱에는 바꾸는 API 가 없다. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, insertable = false, updatable = false)
    private UserRole role;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected AppUserEntity() {
    }

    AppUser toDomain() {
        return new AppUser(id, email, role, createdAt);
    }
}
