package com.ktc4.pusan4.bugreport;

import com.ktc4.pusan4.shared.api.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;

import java.time.Clock;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class BugReportServiceTest {

    @Test
    void without_mail_account_report_is_unavailable_and_nothing_is_counted_or_sent() {
        // given: 로컬처럼 메일 계정이 없다. Redis 는 쓰지 않아야 해서 null 이다
        JavaMailSender mailSender = mock(JavaMailSender.class);
        BugReportService service = new BugReportService(null, mailSender, Clock.systemUTC(), "", "");

        // when / then
        assertThatThrownBy(() -> service.report(UUID.randomUUID(), "버그", null, null, null))
            .isInstanceOfSatisfying(ApiException.class, error -> {
                assertThat(error.getStatus().value()).isEqualTo(503);
                assertThat(error.getCode()).isEqualTo("BUG_REPORT_UNAVAILABLE");
            });
        verifyNoInteractions(mailSender);
    }
}
