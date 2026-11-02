package com.ktc4.pusan4.judgment.persistence;

import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.core.task.SyncTaskExecutor;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

class JudgmentRunnerTest {

    @Test
    void run_puts_run_id_in_mdc_while_running_and_removes_it_after() {
        // given
        UUID runId = UUID.fromString("0199c8f2-0000-7000-8000-000000000001");
        JudgmentRunService runService = mock(JudgmentRunService.class);
        AtomicReference<String> seen = new AtomicReference<>();
        given(runService.start(runId)).willAnswer(invocation -> {
            seen.set(MDC.get("runId"));
            return Optional.empty();
        });
        JudgmentRunner runner = new JudgmentRunner(runService, new SyncTaskExecutor());

        // when
        runner.run(runId);

        // then: 워커 스레드는 재사용되므로 끝나면 지워야 다음 run 의 로그에 섞이지 않는다
        assertThat(seen.get()).isEqualTo(runId.toString());
        assertThat(MDC.get("runId")).isNull();
    }
}
