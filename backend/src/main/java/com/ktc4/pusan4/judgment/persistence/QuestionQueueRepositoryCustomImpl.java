package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.persistence.QuestionQueueRepository.QuestionRow;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;

import java.util.List;
import java.util.UUID;

import static com.ktc4.pusan4.judgment.persistence.TransactionConditions.judgmentTarget;

class QuestionQueueRepositoryCustomImpl implements QuestionQueueRepositoryCustom {

    private static final QQuestionQueueEntity QUESTION = new QQuestionQueueEntity("question");
    private static final QJudgmentEntity JUDGMENT = new QJudgmentEntity("judgment");
    private static final QTransactionRecordEntity TRANSACTION = new QTransactionRecordEntity("transaction");

    private final JPAQueryFactory queryFactory;

    QuestionQueueRepositoryCustomImpl(JPAQueryFactory queryFactory) {
        this.queryFactory = queryFactory;
    }

    @Override
    public List<QuestionRow> findRows(UUID userId, UUID batchId, UUID transactionId) {
        return queryFactory
            .select(Projections.constructor(QuestionRow.class, QUESTION, TRANSACTION.id, TRANSACTION.batchId))
            .from(QUESTION, JUDGMENT, TRANSACTION)
            .where(
                QUESTION.judgmentId.eq(JUDGMENT.id),
                JUDGMENT.transactionId.eq(TRANSACTION.id),
                TRANSACTION.userId.eq(userId),
                batchId == null ? null : TRANSACTION.batchId.eq(batchId),
                transactionId == null ? null : TRANSACTION.id.eq(transactionId),
                judgmentTarget(TRANSACTION)
            )
            .orderBy(QUESTION.createdAt.asc(), QUESTION.id.asc())
            .fetch();
    }
}
