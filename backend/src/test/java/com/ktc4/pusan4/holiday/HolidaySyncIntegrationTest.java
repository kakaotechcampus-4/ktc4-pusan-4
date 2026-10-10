package com.ktc4.pusan4.holiday;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import jakarta.persistence.EntityManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 테스트마다 다른 연도를 써서 같은 표를 공유해도 서로 섞이지 않게 한다. */
@SpringBootTest
@Testcontainers
class HolidaySyncIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @MockitoBean
    private HolidayApiClient client;

    @Autowired
    private HolidaySync sync;

    @Autowired
    private HolidayCalendar calendar;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private EntityManager entityManager;

    @Test
    void replaces_only_the_synced_year() {
        insertHoliday("2025-05-01", "지난 응답에만 있던 날");
        insertHoliday("2024-12-25", "기독탄신일");
        when(client.fetch(2025)).thenReturn(List.of(
            new PublicHoliday(LocalDate.of(2025, 10, 3), "개천절"),
            new PublicHoliday(LocalDate.of(2025, 10, 9), "한글날")
        ));

        sync.syncYear(2025);

        assertThat(calendar.publicHolidays())
            .filteredOn(date -> date.getYear() == 2024 || date.getYear() == 2025)
            .containsExactlyInAnyOrder(
                LocalDate.of(2025, 10, 3), LocalDate.of(2025, 10, 9), LocalDate.of(2024, 12, 25)
            );
    }

    @Test
    void concurrent_replacements_of_the_same_year_do_not_mix() throws Exception {
        insertHoliday("2021-01-01", "1월1일");
        List<PublicHoliday> first = List.of(
            new PublicHoliday(LocalDate.of(2021, 10, 4), "대체공휴일"),
            new PublicHoliday(LocalDate.of(2021, 10, 11), "대체공휴일")
        );
        List<PublicHoliday> second = List.of(new PublicHoliday(LocalDate.of(2021, 10, 11), "대체공휴일"));
        CountDownLatch firstWritten = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            // 첫 교체가 지우고 넣은 뒤 커밋하기 전에 두 번째 교체를 시작한다.
            Future<?> firstReplace = executor.submit(() ->
                new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                    calendar.replaceYear(2021, first);
                    entityManager.flush();
                    firstWritten.countDown();
                    await(releaseFirst);
                })
            );
            assertThat(firstWritten.await(10, TimeUnit.SECONDS)).isTrue();
            Future<?> secondReplace = executor.submit(() -> calendar.replaceYear(2021, second));
            Thread.sleep(300);
            releaseFirst.countDown();
            firstReplace.get(10, TimeUnit.SECONDS);
            secondReplace.get(10, TimeUnit.SECONDS);
        } finally {
            releaseFirst.countDown();
            executor.shutdownNow();
        }

        assertThat(calendar.publicHolidays())
            .filteredOn(date -> date.getYear() == 2021)
            .containsExactly(LocalDate.of(2021, 10, 11));
    }

    @Test
    void keeps_existing_rows_when_the_api_fails() {
        insertHoliday("2023-10-09", "한글날");
        when(client.fetch(2023)).thenThrow(new IllegalStateException("Holiday API error"));

        sync.syncYear(2023);

        assertThat(calendar.publicHolidays()).contains(LocalDate.of(2023, 10, 9));
    }

    @Test
    void keeps_existing_rows_when_the_year_is_empty() {
        insertHoliday("2022-10-09", "한글날");
        when(client.fetch(2022)).thenReturn(List.of());

        sync.syncYear(2022);

        assertThat(calendar.publicHolidays()).contains(LocalDate.of(2022, 10, 9));
    }

    @Test
    void syncs_the_previous_current_and_next_year() {
        int thisYear = LocalDate.now(ZoneId.of("Asia/Seoul")).getYear();
        when(client.configured()).thenReturn(true);
        when(client.fetch(anyInt())).thenReturn(List.of());

        sync.sync();

        verify(client).fetch(thisYear - 1);
        verify(client).fetch(thisYear);
        verify(client).fetch(thisYear + 1);
    }

    @Test
    void skips_without_a_key() {
        when(client.configured()).thenReturn(false);

        sync.sync();

        verify(client, never()).fetch(anyInt());
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void insertHoliday(String date, String name) {
        jdbcTemplate.update(
            "insert into public_holiday(holiday_date, name) values (?::date, ?)", date, name
        );
    }
}
