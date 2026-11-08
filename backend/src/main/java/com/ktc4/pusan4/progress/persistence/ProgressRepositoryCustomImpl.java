package com.ktc4.pusan4.progress.persistence;

import com.ktc4.pusan4.judgment.persistence.QTransactionRecordEntity;
import com.ktc4.pusan4.progress.persistence.ProgressRepository.Pending;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.persistence.QClassificationReviewEntity;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;

import java.util.UUID;

import static com.ktc4.pusan4.judgment.persistence.TransactionConditions.effectiveStatusIs;

class ProgressRepositoryCustomImpl implements ProgressRepositoryCustom {

    private static final QClassificationReviewEntity REVIEW = new QClassificationReviewEntity("review");
    private static final QTransactionRecordEntity TRANSACTION = new QTransactionRecordEntity("transaction");

    private final JPAQueryFactory queryFactory;

    ProgressRepositoryCustomImpl(JPAQueryFactory queryFactory) {
        this.queryFactory = queryFactory;
    }

    @Override
    public Pending countPendingClassification(UUID batchId) {
        return queryFactory
            .select(Projections.constructor(Pending.class, REVIEW.count(), TRANSACTION.amount.sumLong().coalesce(0L)))
            .from(REVIEW, TRANSACTION)
            .where(
                REVIEW.transactionId.eq(TRANSACTION.id),
                TRANSACTION.batchId.eq(batchId),
                REVIEW.status.eq("PENDING"),
                effectiveStatusIs(TRANSACTION, SourceStatus.JUDGEABLE)
            )
            .fetchOne();
    }
}
