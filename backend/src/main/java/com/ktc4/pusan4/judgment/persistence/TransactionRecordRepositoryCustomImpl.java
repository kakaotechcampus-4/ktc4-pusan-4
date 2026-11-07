package com.ktc4.pusan4.judgment.persistence;

import com.querydsl.jpa.JPAExpressions;
import com.querydsl.jpa.impl.JPAQueryFactory;

import java.util.List;
import java.util.UUID;

import static com.ktc4.pusan4.judgment.persistence.TransactionConditions.judgmentTarget;

class TransactionRecordRepositoryCustomImpl implements TransactionRecordRepositoryCustom {

    private static final QTransactionRecordEntity TRANSACTION = new QTransactionRecordEntity("transaction");
    private static final QJudgmentEntity JUDGMENT = new QJudgmentEntity("judgment");

    private final JPAQueryFactory queryFactory;

    TransactionRecordRepositoryCustomImpl(JPAQueryFactory queryFactory) {
        this.queryFactory = queryFactory;
    }

    @Override
    public List<UUID> findRunTargetIds(UUID batchId) {
        return queryFactory.select(TRANSACTION.id)
            .from(TRANSACTION)
            .where(TRANSACTION.batchId.eq(batchId), judgmentTarget(TRANSACTION))
            .orderBy(TRANSACTION.approvedAt.asc(), TRANSACTION.id.asc())
            .fetch();
    }

    @Override
    public List<UUID> findJudgedTargetIdsByMerchant(UUID batchId, String merchantNorm) {
        return queryFactory.select(TRANSACTION.id)
            .from(TRANSACTION)
            .where(
                TRANSACTION.batchId.eq(batchId),
                TRANSACTION.merchantNorm.eq(merchantNorm),
                judgmentTarget(TRANSACTION),
                JPAExpressions.selectOne().from(JUDGMENT).where(JUDGMENT.transactionId.eq(TRANSACTION.id)).exists()
            )
            .fetch();
    }
}
