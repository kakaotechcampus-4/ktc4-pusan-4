package com.ktc4.pusan4.holiday;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HolidaySyncTest {

    // 2026-01-01 00:30 KST 는 UTC 로 아직 2025 년이다. 연도는 KST 로 정해야 한다.
    private static final Clock NEW_YEAR_KST = Clock.fixed(Instant.parse("2025-12-31T15:30:00Z"), ZoneId.of("UTC"));

    private final HolidayApiClient client = mock(HolidayApiClient.class);
    private final HolidayCalendar calendar = mock(HolidayCalendar.class);
    private final HolidaySync sync = new HolidaySync(client, calendar, NEW_YEAR_KST);

    @Test
    void save_failure_does_not_propagate_and_the_other_years_still_sync() {
        List<PublicHoliday> holidays = List.of(new PublicHoliday(LocalDate.of(2026, 10, 9), "한글날"));
        when(client.configured()).thenReturn(true);
        when(client.fetch(anyInt())).thenReturn(holidays);
        doThrow(new DataAccessResourceFailureException("db down")).when(calendar).replaceYear(eq(2025), anyList());

        assertThatCode(sync::sync).doesNotThrowAnyException();

        verify(calendar).replaceYear(2025, holidays);
        verify(calendar).replaceYear(2026, holidays);
        verify(calendar).replaceYear(2027, holidays);
    }
}
