package com.ktc4.pusan4.holiday;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

interface PublicHolidayRepository extends Repository<PublicHolidayEntity, LocalDate> {

    @Query("select holiday.holidayDate from PublicHolidayEntity holiday")
    List<LocalDate> findAllDates();

    List<PublicHolidayEntity> saveAll(Iterable<PublicHolidayEntity> holidays);

    // 같은 해를 동시에 교체하면(기동 직후와 새벽 동기화가 겹치거나 서버가 둘일 때) 한쪽의 삭제가
    // 다른 쪽이 넣은 행을 보지 못해 두 응답이 섞여 남는다. 교체끼리만 막고 판정의 조회는 막지 않는 잠금이다.
    // 트랜잭션이 끝날 때 풀린다.
    @Modifying
    @Query(value = "lock table public_holiday in share row exclusive mode", nativeQuery = true)
    void lockForReplace();

    @Modifying
    @Query("delete from PublicHolidayEntity holiday where holiday.holidayDate between :from and :to")
    int deleteBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
