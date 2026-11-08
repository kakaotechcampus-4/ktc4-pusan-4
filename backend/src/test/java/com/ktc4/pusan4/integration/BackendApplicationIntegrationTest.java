package com.ktc4.pusan4.integration;

import com.ktc4.pusan4.auth.TestUser;
import com.ktc4.pusan4.merchant.classify.ClassificationInput;
import com.ktc4.pusan4.merchant.classify.ClassificationResult;
import com.ktc4.pusan4.merchant.classify.ClassificationStage;
import com.ktc4.pusan4.merchant.classify.MerchantClassifier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 테스트는 기본으로 지표 내보내기를 끈다. /actuator/prometheus 를 보려고 켠다.
@AutoConfigureObservability(tracing = false)
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class BackendApplicationIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private MerchantClassifier merchantClassifier;

    @Autowired
    private ConfigurableApplicationContext context;

    @Test
    void health_endpoint_reports_application_up() throws Exception {
        // Redis 컨테이너 없이 UP 이어야 한다. Redis 는 health 에서 뺐다(application.yml management.health.redis)
        mockMvc.perform(get("/actuator/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void prometheus_endpoint_exposes_dashboard_gauges() throws Exception {
        // 호스트의 CloudWatch Agent 가 이 이름·라벨로 골라 대시보드에 올린다(docs/monitoring_plan.md 지표와 알람)
        mockMvc.perform(get("/actuator/prometheus"))
            .andExpect(status().isOk())
            .andExpect(content().string(containsString("hikaricp_connections_pending{")))
            .andExpect(content().string(containsString("jvm_memory_used_bytes{area=\"heap\"")))
            .andExpect(content().string(containsString("executor_queued_tasks{name=\"judgmentRunExecutor\"")));
    }

    @Test
    void users_me_returns_seeded_temporary_user() throws Exception {
        mockMvc.perform(get("/api/v1/users/me"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(TestUser.ID.toString()))
            .andExpect(jsonPath("$.email").value(TestUser.EMAIL))
            .andExpect(jsonPath("$.createdAt").exists());
    }

    @Test
    void judgment_run_executor_closes_before_entity_manager_factory() {
        // 빈은 만든 역순으로 닫힌다. 실행기가 먼저 닫혀야 종료 때 run 을 기다리는 동안 DB 커넥션 풀이 열려 있다.
        assertThat(context.getBeanFactory().getDependentBeans("entityManagerFactory")).contains("judgmentRunExecutor");
    }

    @Test
    void flyway_initializes_schema_history() {
        Boolean schemaHistoryExists = jdbcTemplate.queryForObject("""
            select exists (
                select 1
                from information_schema.tables
                where table_schema = 'public'
                  and table_name = 'flyway_schema_history'
            )
            """, Boolean.class);

        assertThat(schemaHistoryExists).isTrue();
    }

    @Test
    void merchant_classifier_loads_rules_on_startup() {
        List<ClassificationResult> results = merchantClassifier.classifyAll(
            TestUser.ID,
            List.of(new ClassificationInput("스타벅스코리아 서면점", ""), new ClassificationInput("KG이니시스-스마일카페", "")));

        assertThat(results).extracting(ClassificationResult::stage, ClassificationResult::merchantCategory)
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple(ClassificationStage.KEYWORD, "카페"),
                org.assertj.core.groups.Tuple.tuple(ClassificationStage.PG, "PG_미상"));
    }
}
