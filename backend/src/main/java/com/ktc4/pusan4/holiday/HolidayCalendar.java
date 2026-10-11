package com.ktc4.pusan4.holiday;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * 판정에 넘길 공휴일 집합 (public_holiday). 표가 비어 있으면 엔진은 토·일만 휴일로 본다.
 */
@Service
public class HolidayCalendar {

    private final PublicHolidayRepository repository;

    HolidayCalendar(PublicHolidayRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Set<LocalDate> publicHolidays() {
        return Set.copyOf(repository.findAllDates());
    }

    /** 한 해의 행을 통째로 바꾼다. 취소된 임시공휴일처럼 API 에서 빠진 날도 지워진다. */
    @Transactional
    void replaceYear(int year, List<PublicHoliday> holidays) {
        repository.lockForReplace();
        repository.deleteBetween(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
        repository.saveAll(holidays.stream()
            .map(holiday -> new PublicHolidayEntity(holiday.date(), holiday.name()))
            .toList());
    }
}
