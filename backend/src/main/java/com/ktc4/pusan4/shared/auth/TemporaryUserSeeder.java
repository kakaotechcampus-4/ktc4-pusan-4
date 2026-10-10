package com.ktc4.pusan4.shared.auth;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 임시 사용자 행을 만든다. 이미 있으면 그대로 둔다(재기동·여러 인스턴스에서 안전).
 *
 * <p>Flyway 마이그레이션으로 넣지 않는 이유: 마이그레이션 데이터는 지울 때도 새 마이그레이션이 필요하고,
 * 인증 도입 뒤에도 운영 DB 에 가짜 사용자가 남는다. 이 클래스는 B9b 에서 지우면 끝난다.
 */
@Component
class TemporaryUserSeeder implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    TemporaryUserSeeder(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        jdbcTemplate.update(
            "insert into app_user(id, email) values (?, ?) on conflict do nothing",
            TemporaryCurrentUserProvider.TEMPORARY_USER_ID,
            TemporaryCurrentUserProvider.TEMPORARY_USER_EMAIL
        );
    }
}
