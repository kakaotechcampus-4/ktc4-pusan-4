package com.ktc4.pusan4.judgment.persistence;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * 판정 run 을 실행하는 전용 스레드 풀. 워커 하나가 run 하나를 끝까지 맡으므로 워커 수가 동시에 도는 run 의 최대 개수다.
 * 값은 서버 CPU 에 따라 달라서 설정으로 둔다(app.judgment-run). 운영 값은 application.yml, 로컬 개발 값은
 * application-local.yml 이고, 근거는 그 주석에 있다.
 * 대기열까지 차면 JudgmentRunner 가 그 run 을 RUN_START_FAILED 로 끝낸다.
 */
@Configuration
class JudgmentRunExecutorConfiguration {

    @Bean
    ThreadPoolTaskExecutor judgmentRunExecutor(
        @Value("${app.judgment-run.workers}") int workers,
        @Value("${app.judgment-run.queue-capacity}") int queueCapacity
    ) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(workers);
        executor.setMaxPoolSize(workers);
        executor.setQueueCapacity(queueCapacity);
        executor.setThreadNamePrefix("judgment-run-");
        return executor;
    }
}
