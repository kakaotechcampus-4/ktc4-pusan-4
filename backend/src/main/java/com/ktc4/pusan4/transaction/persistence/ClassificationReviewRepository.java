package com.ktc4.pusan4.transaction.persistence;

import org.springframework.data.repository.Repository;

import java.util.UUID;

interface ClassificationReviewRepository extends Repository<ClassificationReviewEntity, UUID> {

    boolean existsByTransactionIdAndStatus(UUID transactionId, String status);
}
