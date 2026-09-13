package com.ktc4.pusan4.merchant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "merchant_dict")
class MerchantDictionaryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false)
    private String pattern;

    @Column(name = "merchant_norm", nullable = false)
    private String merchantNorm;

    @Column(name = "merchant_category", nullable = false)
    private String merchantCategory;

    @Column(nullable = false)
    private String source;

    @Column(name = "resolved_evidence")
    private String resolvedEvidence;

    @Column(name = "resolved_at", nullable = false)
    private OffsetDateTime resolvedAt;

    @Column(nullable = false, precision = 5, scale = 4)
    private BigDecimal confidence;

    protected MerchantDictionaryEntity() {
    }
}
