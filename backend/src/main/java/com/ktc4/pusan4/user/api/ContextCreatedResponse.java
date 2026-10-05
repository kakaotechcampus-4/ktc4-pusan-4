package com.ktc4.pusan4.user.api;

import com.ktc4.pusan4.user.domain.BusinessContext;

import java.util.UUID;

public record ContextCreatedResponse(UUID id, int version) {

    static ContextCreatedResponse from(BusinessContext context) {
        return new ContextCreatedResponse(context.id(), context.version());
    }
}
