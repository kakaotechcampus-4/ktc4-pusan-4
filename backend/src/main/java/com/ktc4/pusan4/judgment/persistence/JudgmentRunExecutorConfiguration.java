package com.ktc4.pusan4.judgment.persistence;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.DependsOn;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.time.Duration;

/**
 * 판정 run 을 실행하는 전용 스레드 풀. 워커 하나가 run 하나를 끝까지 맡으므로 워커 수가 동시에 도는 run 의 최대 개수다.
 * 값은 서버 CPU 에 따라 달라서 설정으로 둔다(app.judgment-run). 운영 값은 application.yml, 로컬 개발 값은
 * application-local.yml 이고, 근거는 그 주석에 있다.
 * 대기열까지 차면 JudgmentRunner 가 그 run 을 RUN_START_FAILED 로 끝낸다.
 *
 * <p>서버가 종료될 때(배포) 새 run 은 받지 않고, 돌던 run 과 대기열의 run 을 await-termination 까지 마저 처리한다.
 * 그 안에 못 끝낸 run 은 남고, 다음 서버의 멈춘 run 정리(JudgmentRunService.interruptStale)가 RUN_INTERRUPTED 로 끝낸다.
 * 빈은 만든 역순으로 닫히므로, entityManagerFactory 뒤에 만들어 run 을 기다리는 동안 DB 커넥션 풀이 열려 있게 한다.
 */
@Configuration
class JudgmentRunExecutorConfiguration {

    @Bean
    @DependsOn("entityManagerFactory")
    ThreadPoolTaskExecutor judgmentRunExecutor(
        @Value("${app.judgment-run.workers}") int workers,
        @Value("${app.judgment-run.queue-capacity}") int queueCapacity,
        @Value("${app.judgment-run.await-termination}") Duration awaitTermination
    ) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(workers);
        executor.setMaxPoolSize(workers);
        executor.setQueueCapacity(queueCapacity);
        executor.setThreadNamePrefix("judgment-run-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationMillis(awaitTermination.toMillis());
        return executor;
    }
}
