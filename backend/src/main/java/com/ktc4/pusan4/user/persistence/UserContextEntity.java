package com.ktc4.pusan4.user.persistence;

import com.ktc4.pusan4.user.domain.BookkeepingDuty;
import com.ktc4.pusan4.user.domain.BusinessContext;
import com.ktc4.pusan4.user.domain.NewBusinessContext;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_context")
class UserContextEntity {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "industry_code", nullable = false)
    private String industryCode;

    @Column(name = "prev_year_revenue", nullable = false)
    private long prevYearRevenue;

    @Column(name = "business_open_date", nullable = false)
    private LocalDate businessOpenDate;

    /** 한글 enum 이름 그대로 저장한다. DB CHECK 도 같은 값이다. */
    @Enumerated(EnumType.STRING)
    @Column(name = "bookkeeping_duty", nullable = false)
    private BookkeepingDuty bookkeepingDuty;

    @Column(name = "has_employee", nullable = false)
    private boolean hasEmployee;

    @Column(name = "home_office_ratio")
    private Integer homeOfficeRatio;

    @Column(nullable = false)
    private int version;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected UserContextEntity() {
    }

    UserContextEntity(UUID id, UUID userId, int version, NewBusinessContext input) {
        this.id = id;
        this.userId = userId;
        this.version = version;
        this.industryCode = input.industryCode();
        this.prevYearRevenue = input.prevYearRevenue();
        this.businessOpenDate = input.businessOpenDate();
        this.bookkeepingDuty = input.bookkeepingDuty();
        this.hasEmployee = input.hasEmployee();
        this.homeOfficeRatio = input.homeOfficeRatio();
    }

    BusinessContext toDomain() {
        return new BusinessContext(id, userId, version, industryCode, prevYearRevenue, businessOpenDate,
            bookkeepingDuty, hasEmployee, homeOfficeRatio, createdAt);
    }
}
