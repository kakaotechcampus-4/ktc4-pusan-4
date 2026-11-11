package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.QuestionStatus;
import com.ktc4.pusan4.judgment.persistence.QuestionQueueRepository.QuestionRow;
import com.querydsl.core.types.Predicate;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.JPAExpressions;
import com.querydsl.jpa.impl.JPAQuery;
import com.querydsl.jpa.impl.JPAQueryFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.support.PageableExecutionUtils;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import static com.ktc4.pusan4.judgment.persistence.TransactionConditions.judgmentTarget;

class QuestionQueueRepositoryCustomImpl implements QuestionQueueRepositoryCustom {

    private static final QQuestionQueueEntity QUESTION = new QQuestionQueueEntity("question");
    private static final QJudgmentEntity JUDGMENT = new QJudgmentEntity("judgment");
    private static final QTransactionRecordEntity TRANSACTION = new QTransactionRecordEntity("transaction");
    private static final QTransactionRecordEntity PENDING_TRANSACTION = new QTransactionRecordEntity("pendingTransaction");

    private final JPAQueryFactory queryFactory;

    QuestionQueueRepositoryCustomImpl(JPAQueryFactory queryFactory) {
        this.queryFactory = queryFactory;
    }

    @Override
    public List<QuestionRow> findRows(UUID userId, UUID batchId, UUID transactionId) {
        return rows(conditions(userId, batchId, transactionId, null)).fetch();
    }

    @Override
    public List<QuestionRow> findPendingRows(UUID userId, UUID batchId) {
        return rows(conditions(userId, batchId, null, QuestionStatus.PENDING.name())).fetch();
    }

    @Override
    public Page<QuestionRow> findRowsPage(
        UUID userId, UUID batchId, UUID transactionId, String status, Pageable pageable
    ) {
        Predicate[] conditions = conditions(userId, batchId, transactionId, status);
        List<QuestionRow> page = rows(conditions).offset(pageable.getOffset()).limit(pageable.getPageSize()).fetch();
        return PageableExecutionUtils.getPage(page, pageable,
            () -> queryFactory.select(QUESTION.count()).from(QUESTION, JUDGMENT, TRANSACTION).where(conditions).fetchOne());
    }

    @Override
    public PendingCount countPending(UUID userId, UUID batchId, UUID transactionId) {
        Predicate[] pending = conditions(userId, batchId, transactionId, QuestionStatus.PENDING.name());
        Long count = queryFactory.select(QUESTION.count()).from(QUESTION, JUDGMENT, TRANSACTION).where(pending).fetchOne();
        Long amount = queryFactory.select(PENDING_TRANSACTION.amount.sumLong().coalesce(0L))
            .from(PENDING_TRANSACTION)
            .where(PENDING_TRANSACTION.id.in(
                JPAExpressions.select(TRANSACTION.id).from(QUESTION, JUDGMENT, TRANSACTION).where(pending)))
            .fetchOne();
        return new PendingCount(count == null ? 0 : count, amount);
    }

    @Override
    public List<MemberRow> findMembers(UUID userId, UUID batchId, UUID transactionId, String status) {
        return queryFactory
            .select(Projections.constructor(MemberRow.class, QUESTION.id, TRANSACTION.batchId, QUESTION.groupKey,
                QUESTION.factType, QUESTION.status, TRANSACTION.id, TRANSACTION.approvedAt, TRANSACTION.amount))
            .from(QUESTION, JUDGMENT, TRANSACTION)
            .where(conditions(userId, batchId, transactionId, status))
            .fetch();
    }

    @Override
    public List<QuestionRow> findRowsByIds(Collection<UUID> questionIds) {
        if (questionIds.isEmpty()) {
            return List.of();
        }
        return queryFactory
            .select(Projections.constructor(QuestionRow.class, QUESTION, TRANSACTION.id, TRANSACTION.batchId))
            .from(QUESTION, JUDGMENT, TRANSACTION)
            .where(QUESTION.id.in(questionIds),
                QUESTION.judgmentId.eq(JUDGMENT.id),
                JUDGMENT.transactionId.eq(TRANSACTION.id))
            .orderBy(QUESTION.createdAt.asc(), QUESTION.id.asc())
            .fetch();
    }

    @Override
    public List<UUID> findPendingTransactionIds(Collection<UUID> transactionIds) {
        if (transactionIds.isEmpty()) {
            return List.of();
        }
        return queryFactory.selectDistinct(JUDGMENT.transactionId)
            .from(QUESTION, JUDGMENT)
            .where(QUESTION.judgmentId.eq(JUDGMENT.id),
                JUDGMENT.transactionId.in(transactionIds),
                QUESTION.status.eq(QuestionStatus.PENDING.name()))
            .fetch();
    }

    private JPAQuery<QuestionRow> rows(Predicate[] conditions) {
        return queryFactory
            .select(Projections.constructor(QuestionRow.class, QUESTION, TRANSACTION.id, TRANSACTION.batchId))
            .from(QUESTION, JUDGMENT, TRANSACTION)
            .where(conditions)
            .orderBy(QUESTION.createdAt.asc(), QUESTION.id.asc());
    }

    private static Predicate[] conditions(UUID userId, UUID batchId, UUID transactionId, String status) {
        return new Predicate[] {
            QUESTION.judgmentId.eq(JUDGMENT.id),
            JUDGMENT.transactionId.eq(TRANSACTION.id),
            TRANSACTION.userId.eq(userId),
            batchId == null ? null : TRANSACTION.batchId.eq(batchId),
            transactionId == null ? null : TRANSACTION.id.eq(transactionId),
            status == null ? null : QUESTION.status.eq(status),
            judgmentTarget(TRANSACTION),
        };
    }
}
