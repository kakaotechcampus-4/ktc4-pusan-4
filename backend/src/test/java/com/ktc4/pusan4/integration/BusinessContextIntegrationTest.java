package com.ktc4.pusan4.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.user.domain.BookkeepingDuty;
import com.ktc4.pusan4.user.domain.BusinessContext;
import com.ktc4.pusan4.user.domain.NewBusinessContext;
import com.ktc4.pusan4.user.persistence.BusinessContextService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class BusinessContextIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    private static final NewBusinessContext INPUT = new NewBusinessContext(
        "940909", 48_000_000L, LocalDate.parse("2024-03-02"), BookkeepingDuty.간편장부, false, null);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private BusinessContextService contextService;

    @Test
    void each_post_creates_next_version_and_current_is_latest() throws Exception {
        // given
        String body = """
            {"industryCode": "940909", "prevYearRevenue": 48000000, "businessOpenDate": "2024-03-02",
             "bookkeepingDuty": "간편장부", "hasEmployee": false}
            """;

        // when: 두 번 문진한다
        int first = createdVersion(body);
        int second = createdVersion(body.replace("\"hasEmployee\": false", "\"hasEmployee\": true"));

        // then: 버전이 하나씩 오르고, current 는 마지막 버전이다
        assertThat(second).isEqualTo(first + 1);
        mockMvc.perform(get("/api/v1/users/me/contexts/current"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version").value(second))
            .andExpect(jsonPath("$.hasEmployee").value(true))
            .andExpect(jsonPath("$.bookkeepingDuty").value("간편장부"))
            .andExpect(jsonPath("$.homeOfficeRatio").isEmpty())
            .andExpect(jsonPath("$.createdAt").exists());

        // 이력은 version 오름차순이고 이전 버전은 고쳐지지 않는다
        JsonNode history = objectMapper.readTree(mockMvc.perform(get("/api/v1/users/me/contexts"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        List<Integer> versions = new ArrayList<>();
        history.forEach(item -> versions.add(item.path("version").asInt()));
        assertThat(versions).isSorted().contains(first, second);
        assertThat(history.get(versions.indexOf(first)).path("hasEmployee").asBoolean()).isFalse();
    }

    @Test
    void current_is_not_found_before_first_context() {
        UUID userId = insertUser();

        assertThatThrownBy(() -> contextService.current(userId))
            .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("CONTEXT_NOT_FOUND"));
        assertThat(contextService.history(userId)).isEmpty();
    }

    @Test
    void concurrent_creates_get_distinct_consecutive_versions() throws Exception {
        UUID userId = insertUser();
        int requests = 5;
        ExecutorService executor = Executors.newFixedThreadPool(requests);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<BusinessContext>> futures = IntStream.range(0, requests)
                .mapToObj(i -> executor.submit(() -> {
                    start.await();
                    return contextService.create(userId, INPUT);
                }))
                .toList();
            start.countDown();

            List<Integer> versions = new ArrayList<>();
            for (Future<BusinessContext> future : futures) {
                versions.add(future.get(10, TimeUnit.SECONDS).version());
            }
            assertThat(versions).containsExactlyInAnyOrder(1, 2, 3, 4, 5);
        } finally {
            executor.shutdownNow();
            executor.awaitTermination(10, TimeUnit.SECONDS);
        }
    }

    @Test
    void create_for_missing_user_is_unauthorized() {
        assertThatThrownBy(() -> contextService.create(UUID.randomUUID(), INPUT))
            .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("UNAUTHORIZED"));
    }

    private int createdVersion(String body) throws Exception {
        String response = mockMvc.perform(post("/api/v1/users/me/contexts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).path("version").asInt();
    }

    private UUID insertUser() {
        UUID userId = UUID.randomUUID();
        jdbcTemplate.update("insert into app_user(id, email) values (?, ?)", userId, userId + "@example.com");
        return userId;
    }
}
