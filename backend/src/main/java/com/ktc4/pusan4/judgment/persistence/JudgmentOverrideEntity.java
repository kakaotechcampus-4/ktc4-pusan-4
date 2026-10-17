package com.ktc4.pusan4.judgment.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * 사용자 판정 수정 (V7, api.md 3.8). 지금은 현재 판정을 고르는 데만 읽는다. 생성·해제는 A5 에서 붙인다.
 */
@Entity
@Table(name = "judgment_override")
class JudgmentOverrideEntity {

    @Id
    private UUID id;

    @Column(name = "transaction_id", nullable = false)
    private UUID transactionId;

    /** 거래당 활성 override 는 하나다(uq_judgment_override_active_transaction). */
    @Column(nullable = false)
    private boolean active;

    protected JudgmentOverrideEntity() {
    }
}
