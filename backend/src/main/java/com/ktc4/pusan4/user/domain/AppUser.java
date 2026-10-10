package com.ktc4.pusan4.user.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AppUser(UUID id, String email, OffsetDateTime createdAt) {
}
