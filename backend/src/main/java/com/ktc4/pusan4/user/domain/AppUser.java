package com.ktc4.pusan4.user.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

/** @param email 카카오 계정은 null 이다 */
public record AppUser(UUID id, String email, OffsetDateTime createdAt) {
}
