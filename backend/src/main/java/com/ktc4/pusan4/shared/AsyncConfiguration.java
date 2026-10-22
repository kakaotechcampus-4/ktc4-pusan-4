package com.ktc4.pusan4.shared;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/** @Async 를 켠다. 실행기는 Spring Boot 기본 applicationTaskExecutor 다. */
@Configuration
@EnableAsync
public class AsyncConfiguration {
}
