package com.ktc4.pusan4.holiday;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * 공휴일 표를 API 와 맞춘다. 기동할 때와 매일 새벽에 올해 앞뒤 1년씩 받는다.
 * 받지 못한 해는 기존 행을 그대로 둔다. 동기화가 실패해도 판정은 표에 있는 값으로 계속 돈다.
 */
@Component
class HolidaySync {

    private static final Logger log = LoggerFactory.getLogger(HolidaySync.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final HolidayApiClient client;
    private final HolidayCalendar calendar;
    private final Clock clock;

    HolidaySync(HolidayApiClient client, HolidayCalendar calendar, Clock clock) {
        this.client = client;
        this.calendar = calendar;
        this.clock = clock;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(cron = "0 0 4 * * *", zone = "Asia/Seoul")
    void sync() {
        if (!client.configured()) {
            log.info("HOLIDAY_API_KEY 가 없어 공휴일 동기화를 건너뛴다");
            return;
        }
        int thisYear = LocalDate.now(clock.withZone(KST)).getYear();
        for (int year = thisYear - 1; year <= thisYear + 1; year++) {
            syncYear(year);
        }
    }

    void syncYear(int year) {
        List<PublicHoliday> holidays;
        try {
            holidays = client.fetch(year);
        } catch (RuntimeException e) {
            log.warn("{}년 공휴일을 받지 못해 기존 값을 유지한다", year, e);
            return;
        }
        // 다음 해는 발표 전이면 비어 온다. 빈 응답으로 기존 행을 지우지 않는다.
        if (holidays.isEmpty()) {
            log.info("{}년 공휴일 응답이 비어 기존 값을 유지한다", year);
            return;
        }
        // 저장 실패도 기동을 막지 않는다. 기동 직후 동기화는 ApplicationReadyEvent 에서 돌아서,
        // 여기서 던지면 애플리케이션이 뜨지 못한다.
        try {
            calendar.replaceYear(year, holidays);
        } catch (RuntimeException e) {
            log.warn("{}년 공휴일을 저장하지 못해 기존 값을 유지한다", year, e);
            return;
        }
        log.info("{}년 공휴일 {}건을 반영했다", year, holidays.size());
    }
}
