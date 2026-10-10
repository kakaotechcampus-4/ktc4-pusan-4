package com.ktc4.pusan4.holiday;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "public_holiday")
class PublicHolidayEntity {

    @Id
    @Column(name = "holiday_date")
    private LocalDate holidayDate;

    @Column(nullable = false)
    private String name;

    @Column(name = "fetched_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime fetchedAt;

    protected PublicHolidayEntity() {
    }

    PublicHolidayEntity(LocalDate holidayDate, String name) {
        this.holidayDate = holidayDate;
        this.name = name;
    }
}
