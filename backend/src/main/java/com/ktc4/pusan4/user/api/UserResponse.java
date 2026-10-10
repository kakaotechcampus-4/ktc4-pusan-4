package com.ktc4.pusan4.user.api;

import com.ktc4.pusan4.user.domain.AppUser;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UserResponse(UUID id, String email, OffsetDateTime createdAt) {

    static UserResponse from(AppUser user) {
        return new UserResponse(user.id(), user.email(), user.createdAt());
    }
}
