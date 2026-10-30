package com.ktc4.pusan4.holiday;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/** 시드 파일은 2026-10-20 실제 특일정보 API 응답이다. 건수는 그때 응답 기준이다. */
class HolidaySeedTest {

    private final HolidaySeed seed = new HolidaySeed();

    @Test
    void reads_every_seeded_year() {
        assertThat(seed.holidays(2025)).hasSize(19)
            .contains(new PublicHoliday(LocalDate.of(2025, 5, 5), "어린이날, 부처님오신날"));
        assertThat(seed.holidays(2026)).hasSize(22)
            .contains(new PublicHoliday(LocalDate.of(2026, 10, 5), "대체공휴일(개천절)"));
        assertThat(seed.holidays(2027)).hasSize(24)
            .contains(new PublicHoliday(LocalDate.of(2027, 12, 27), "대체공휴일(기독탄신일)"));
    }

    @Test
    void has_nothing_for_a_year_without_a_file() {
        assertThat(seed.holidays(2024)).isEmpty();
    }
}
