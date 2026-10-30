package com.ktc4.pusan4.integration;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * 락 순서 "사용자 → 거래"(UserFactPersistenceService.nextVersion) 를 교착으로 확인한다.
 * 다른 트랜잭션이 사용자 락을 쥔 채 작업이 그 락을 기다리게 한 뒤, 작업이 잡는 행 락을 요청한다.
 * 작업이 그 행을 먼저 잠갔다면 서로 기다리게 되어 Postgres 가 교착(40P01)으로 한쪽을 끊는다.
 */
final class UserLockOrder {

    static final String TRANSACTION_ROW = "select id from transaction where id = ? for update";
    static final String OVERRIDE_ROW = "select id from judgment_override where id = ? for update";

    private UserLockOrder() {
    }

    static void assertTakesUserLockFirst(
        JdbcTemplate jdbcTemplate,
        PlatformTransactionManager transactionManager,
        UUID userId,
        String rowLockSql,
        UUID rowId,
        Callable<?> operation
    ) throws Exception {
        ExecutorService thread = Executors.newSingleThreadExecutor();
        try {
            Future<?> running = new TransactionTemplate(transactionManager).execute(status -> {
                // 순서가 틀렸을 때 교착 감지(deadlock_timeout 1초)보다 오래 걸리면 다른 이유로 막힌 것이다
                jdbcTemplate.execute("set local lock_timeout = '5s'");
                jdbcTemplate.queryForList("select id from app_user where id = ? for no key update", userId);
                Future<?> submitted = thread.submit(operation);
                awaitLockWaiter(jdbcTemplate);
                jdbcTemplate.queryForList(rowLockSql, rowId);
                return submitted;
            });
            running.get(10, TimeUnit.SECONDS);
        } finally {
            thread.shutdownNow();
        }
    }

    static void awaitLockWaiter(JdbcTemplate jdbcTemplate) {
        for (int attempt = 0; attempt < 100; attempt++) {
            Integer waiting = jdbcTemplate.queryForObject("""
                select count(*) from pg_stat_activity
                where datname = current_database() and wait_event_type = 'Lock'
                """, Integer.class);
            if (waiting != null && waiting > 0) {
                return;
            }
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new AssertionError(e);
            }
        }
        throw new AssertionError("락을 기다리는 세션이 없다");
    }
}
