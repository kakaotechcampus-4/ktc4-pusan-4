package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.auth.TestUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.context.ImportTestcontainers;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 버그 신고 (api.md 3.16). 로그인한 사용자의 신고를 팀 메일로 보낸다. 메일은 보내지 않고 보낼 내용을 본다.
 */
@SpringBootTest(properties = "spring.mail.username=team@example.com")
@AutoConfigureMockMvc
@Testcontainers
@ImportTestcontainers(RedisTestContainer.class)
class BugReportIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final String REPORT = """
        {
          "message": "결과 화면에서 금액이 0원으로 나와요",
          "pageUrl": "https://preet.example/results?batch=1",
          "userAgent": "Mozilla/5.0",
          "traceId": "trace-123"
        }
        """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private StringRedisTemplate redis;

    @MockitoBean
    private JavaMailSender mailSender;

    @BeforeEach
    void clearCounts() {
        Set<String> keys = redis.keys("bug-report:*");
        if (keys != null && !keys.isEmpty()) {
            redis.delete(keys);
        }
    }

    @Test
    void report_is_mailed_to_team_with_user_id_and_trace() throws Exception {
        // when
        report(REPORT).andExpect(status().isAccepted());

        // then: 받는 곳은 팀 메일, 본문에는 사용자 id 와 화면 정보만 있고 이메일 주소는 없다
        ArgumentCaptor<SimpleMailMessage> sent = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(sent.capture());
        SimpleMailMessage mail = sent.getValue();
        assertThat(mail.getTo()).containsExactly("team@example.com");
        assertThat(mail.getFrom()).isEqualTo("team@example.com");
        assertThat(mail.getSubject()).isEqualTo("[PreeT 버그 신고] 결과 화면에서 금액이 0원으로 나와요");
        assertThat(mail.getText())
            .contains(TestUser.ID.toString(), "https://preet.example/results?batch=1", "Mozilla/5.0", "trace-123",
                "결과 화면에서 금액이 0원으로 나와요")
            .doesNotContain(TestUser.EMAIL);
    }

    @Test
    void subject_takes_first_line_only() throws Exception {
        report("""
            {"message": "첫 줄\\r\\nBcc: someone@example.com\\n둘째 줄"}
            """).andExpect(status().isAccepted());

        ArgumentCaptor<SimpleMailMessage> sent = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(sent.capture());
        assertThat(sent.getValue().getSubject()).isEqualTo("[PreeT 버그 신고] 첫 줄");
    }

    @Test
    void reports_are_limited_per_user_per_hour() throws Exception {
        for (int i = 0; i < 5; i++) {
            report(REPORT).andExpect(status().isAccepted());
        }

        report(REPORT)
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.code").value("BUG_REPORT_RATE_LIMITED"));
    }

    @Test
    void blank_message_is_rejected() throws Exception {
        report("""
            {"message": "   "}
            """).andExpect(status().isBadRequest());

        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void mail_failure_returns_send_failed() throws Exception {
        doThrow(new MailSendException("SMTP 장애")).when(mailSender).send(any(SimpleMailMessage.class));

        report(REPORT)
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.code").value("BUG_REPORT_SEND_FAILED"));
    }

    @Test
    void report_requires_login() throws Exception {
        MockMvc anonymous = MockMvcBuilders.webAppContextSetup(context).build();

        anonymous.perform(post("/api/v1/bug-reports").contentType(MediaType.APPLICATION_JSON).content(REPORT))
            .andExpect(status().isUnauthorized());
    }

    private ResultActions report(String body) throws Exception {
        return mockMvc.perform(post("/api/v1/bug-reports").contentType(MediaType.APPLICATION_JSON).content(body));
    }
}
