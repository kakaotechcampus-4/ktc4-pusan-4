package com.ktc4.pusan4.integration;

import org.springframework.core.Ordered;
import org.springframework.test.context.TestContext;
import org.springframework.test.context.support.AbstractTestExecutionListener;

/**
 * 통합 테스트 클래스가 끝나면 그 컨텍스트를 바로 닫는다. {@code src/test/resources/META-INF/spring.factories} 로 붙는다.
 *
 * <p>통합 테스트는 클래스마다 자기 PostgreSQL 컨테이너를 띄워 컨텍스트를 다시 쓰지 않는다. 캐시에 남겨 두면
 * 클래스가 끝나 꺼진 DB 로 {@code @Scheduled} 작업(JudgmentRunner.interruptStale)이 1분마다 접속해 ERROR 로그를 쌓는다.
 * 캐시 크기를 줄이는 방법은 다음 컨텍스트가 뜬 뒤에 닫아서, 같이 쓰는 {@link RedisTestContainer} 를 쓰는 중에 꺼 버린다.
 */
public class CloseIntegrationTestContext extends AbstractTestExecutionListener {

    // after 콜백은 역순으로 돈다. 가장 앞에 두어야 다른 리스너가 다 끝난 뒤에 닫는다.
    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    @Override
    public void afterTestClass(TestContext testContext) {
        if (testContext.getTestClass().getSimpleName().endsWith("IntegrationTest")) {
            testContext.markApplicationContextDirty(null);
        }
    }
}
