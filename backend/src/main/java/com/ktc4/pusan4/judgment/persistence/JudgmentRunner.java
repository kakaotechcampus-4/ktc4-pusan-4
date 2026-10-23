package com.ktc4.pusan4.judgment.persistence;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * run 을 만든 트랜잭션이 커밋된 뒤 판정 전용 스레드 풀(JudgmentRunExecutorConfiguration)에서 거래를 한 건씩 판정한다.
 * 건마다 따로 커밋해서, 한 건의 기술적 실패가 다른 건을 막지 않고 진행 상황이 폴링에 바로 보인다.
 *
 * <p>실행 중에 서버가 내려가면 run 이 남는다. 1분마다 진행이 멈춘 run 을 실패로 끝낸다(JudgmentRunService.interruptStale).
 */
@Component
class JudgmentRunner {

    private static final Logger log = LoggerFactory.getLogger(JudgmentRunner.class);

    private final JudgmentRunService runService;
    private final TaskExecutor executor;

    JudgmentRunner(JudgmentRunService runService, @Qualifier("judgmentRunExecutor") TaskExecutor executor) {
        this.runService = runService;
        this.executor = executor;
    }

    /**
     * 풀에 직접 넘긴다. @Async 로 넘기면 대기열이 찼을 때의 거절 예외가 run 을 만든 요청의 커밋 뒤에 그 요청으로 던져져,
     * run 은 저장됐는데 응답이 500 이 된다. 받지 못한 run 은 RUN_START_FAILED 로 끝내 폴링에 보이게 한다.
     */
    @TransactionalEventListener
    public void onCreated(JudgmentRunCreated event) {
        try {
            executor.execute(() -> run(event.runId()));
        } catch (TaskRejectedException e) {
            log.warn("판정 대기열이 가득 차 판정 실행 {} 을 시작하지 못했다", event.runId());
            runService.fail(event.runId());
        }
    }

    @Scheduled(fixedDelay = 1, initialDelay = 1, timeUnit = TimeUnit.MINUTES)
    public void interruptStale() {
        runService.interruptStale();
    }

    void run(UUID runId) {
        Optional<JudgmentRunService.RunStart> started;
        try {
            started = runService.start(runId);
        } catch (RuntimeException e) {
            log.error("판정 실행 {} 을 시작하지 못했다", runId, e);
            runService.fail(runId);
            return;
        }
        if (started.isEmpty()) {
            log.warn("판정 실행 {} 은 이미 끝나 시작하지 않는다", runId);
            return;
        }
        JudgmentRunService.RunStart start = started.get();
        for (UUID transactionId : start.transactionIds()) {
            try {
                if (!runService.judgeItem(runId, transactionId, start.context())) {
                    log.warn("판정 실행 {} 이 중단으로 끝나 남은 거래를 판정하지 않는다", runId);
                    return;
                }
            } catch (RuntimeException e) {
                log.warn("판정 실행 {} 의 거래 {} 판정 실패", runId, transactionId, e);
                runService.recordFailure(runId, transactionId);
            }
        }
        runService.complete(runId);
    }
}
