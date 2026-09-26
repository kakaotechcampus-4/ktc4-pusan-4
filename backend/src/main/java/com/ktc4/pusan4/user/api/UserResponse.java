package com.ktc4.pusan4.user.api;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UserResponse(UUID id, String email, OffsetDateTime createdAt) {
}
