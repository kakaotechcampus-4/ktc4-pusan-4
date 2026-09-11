package com.ktc4.pusan4.shared;

import java.util.UUID;

@FunctionalInterface
public interface UuidGenerator {

    UUID generate();
}
