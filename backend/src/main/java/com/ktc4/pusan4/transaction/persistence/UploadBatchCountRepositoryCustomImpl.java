package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.judgment.persistence.QTransactionRecordEntity;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.persistence.UploadBatchCountRepository.BatchCount;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import static com.ktc4.pusan4.judgment.persistence.TransactionConditions.effectiveStatusIs;

class UploadBatchCountRepositoryCustomImpl implements UploadBatchCountRepositoryCustom {

    private static final QClassificationReviewEntity REVIEW = new QClassificationReviewEntity("review");
    private static final QTransactionRecordEntity TRANSACTION = new QTransactionRecordEntity("transaction");

    private final JPAQueryFactory queryFactory;

    UploadBatchCountRepositoryCustomImpl(JPAQueryFactory queryFactory) {
        this.queryFactory = queryFactory;
    }

    @Override
    public List<BatchCount> countPendingReviews(Collection<UUID> batchIds) {
        return queryFactory
            .select(Projections.constructor(BatchCount.class, TRANSACTION.batchId, REVIEW.count()))
            .from(REVIEW, TRANSACTION)
            .where(
                REVIEW.transactionId.eq(TRANSACTION.id),
                TRANSACTION.batchId.in(batchIds),
                REVIEW.status.eq("PENDING"),
                effectiveStatusIs(TRANSACTION, SourceStatus.JUDGEABLE)
            )
            .groupBy(TRANSACTION.batchId)
            .fetch();
    }
}
