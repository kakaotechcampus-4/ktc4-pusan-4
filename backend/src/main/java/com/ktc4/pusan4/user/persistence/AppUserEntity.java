package com.ktc4.pusan4.user.persistence;

import com.ktc4.pusan4.user.domain.AppUser;
import com.ktc4.pusan4.user.domain.EmailCredential;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Entity
@Table(name = "app_user")
class AppUserEntity {

    @Id
    private UUID id;

    /** 카카오 계정은 비어 있다. */
    @Column
    private String email;

    /** 이메일 계정의 BCrypt 해시. 이메일 가입 전에 있던 행은 비어 있다. */
    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected AppUserEntity() {
    }

    Optional<EmailCredential> emailCredential() {
        return Optional.ofNullable(passwordHash).map(hash -> new EmailCredential(id, hash));
    }

    AppUser toDomain() {
        return new AppUser(id, email, createdAt);
    }
}
