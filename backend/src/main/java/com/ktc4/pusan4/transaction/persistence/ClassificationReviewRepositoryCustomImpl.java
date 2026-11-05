package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.judgment.persistence.QTransactionRecordEntity;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.persistence.ClassificationReviewRepository.ReviewRow;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;

import java.util.List;
import java.util.UUID;

import static com.ktc4.pusan4.judgment.persistence.TransactionConditions.effectiveStatusIs;

class ClassificationReviewRepositoryCustomImpl implements ClassificationReviewRepositoryCustom {

    private static final QClassificationReviewEntity REVIEW = new QClassificationReviewEntity("review");
    private static final QTransactionRecordEntity TRANSACTION = new QTransactionRecordEntity("transaction");

    private final JPAQueryFactory queryFactory;

    ClassificationReviewRepositoryCustomImpl(JPAQueryFactory queryFactory) {
        this.queryFactory = queryFactory;
    }

    @Override
    public List<ReviewRow> findRows(UUID userId, UUID batchId) {
        return findRowsIn(userId, batchId);
    }

    @Override
    public List<ReviewRow> findRows(UUID userId) {
        return findRowsIn(userId, null);
    }

    private List<ReviewRow> findRowsIn(UUID userId, UUID batchId) {
        return queryFactory
            .select(Projections.constructor(ReviewRow.class,
                REVIEW.id, TRANSACTION.batchId, TRANSACTION.id, REVIEW.status, REVIEW.createdAt, REVIEW.resolvedAt,
                TRANSACTION.approvedAt, TRANSACTION.merchantRaw, TRANSACTION.merchantNorm, TRANSACTION.merchantCategory,
                TRANSACTION.amount, TRANSACTION.installmentMonths))
            .from(REVIEW, TRANSACTION)
            .where(
                REVIEW.transactionId.eq(TRANSACTION.id),
                TRANSACTION.userId.eq(userId),
                batchId == null ? null : TRANSACTION.batchId.eq(batchId),
                effectiveStatusIs(TRANSACTION, SourceStatus.JUDGEABLE)
            )
            .orderBy(REVIEW.createdAt.asc(), REVIEW.id.asc())
            .fetch();
    }
}
