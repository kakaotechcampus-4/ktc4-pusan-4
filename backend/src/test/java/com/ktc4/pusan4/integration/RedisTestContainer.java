package com.ktc4.pusan4.integration;

import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.GenericContainer;

/**
 * 통합 테스트용 Redis. Redis 가 필요한 테스트 클래스에 {@code @ImportTestcontainers(RedisTestContainer.class)} 로 붙인다.
 * 컨테이너는 Spring 이 띄우고 spring.data.redis 접속 정보를 채운다. 이미지는 운영(deploy/compose.yaml)과 같다.
 *
 * <p>Redis 를 쓰지 않는 테스트에는 붙이지 않아도 된다. 연결은 처음 쓸 때 맺어서 컨텍스트는 그대로 뜬다.
 * 다만 /actuator/health 는 Redis 상태를 포함하므로 health 를 보는 테스트에는 붙여야 한다.
 */
public interface RedisTestContainer {

    @ServiceConnection(name = "redis")
    GenericContainer<?> REDIS = new GenericContainer<>("redis:7.4-alpine").withExposedPorts(6379);
}
