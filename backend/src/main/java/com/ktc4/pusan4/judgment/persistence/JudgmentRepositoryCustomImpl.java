package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.persistence.JudgmentRepository.LimitTagged;
import com.querydsl.core.types.Predicate;
import com.querydsl.core.types.Projections;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.core.types.dsl.Expressions;
import com.querydsl.jpa.impl.JPAQuery;
import com.querydsl.jpa.impl.JPAQueryFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.support.PageableExecutionUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static com.ktc4.pusan4.judgment.persistence.TransactionConditions.judgmentTarget;

class JudgmentRepositoryCustomImpl implements JudgmentRepositoryCustom {

    private static final QJudgmentEntity JUDGMENT = new QJudgmentEntity("judgment");
    private static final QTransactionRecordEntity TRANSACTION = new QTransactionRecordEntity("transaction");

    private final JPAQueryFactory queryFactory;

    JudgmentRepositoryCustomImpl(JPAQueryFactory queryFactory) {
        this.queryFactory = queryFactory;
    }

    @Override
    public Page<JudgmentEntity> findPage(
        UUID userId,
        UUID transactionId,
        UUID batchId,
        LocalDate yearStart,
        LocalDate yearEnd,
        String verdict,
        UUID runId,
        boolean history,
        Pageable pageable
    ) {
        Predicate[] conditions = {
            TRANSACTION.id.eq(JUDGMENT.transactionId),
            TRANSACTION.userId.eq(userId),
            transactionId == null ? null : TRANSACTION.id.eq(transactionId),
            batchId == null ? null : TRANSACTION.batchId.eq(batchId),
            yearStart == null ? null : TRANSACTION.approvedAt.goe(yearStart).and(TRANSACTION.approvedAt.lt(yearEnd)),
            verdict == null ? null : JUDGMENT.verdict.eq(verdict),
            scope(transactionId, runId, history),
        };
        JPAQuery<JudgmentEntity> rows = queryFactory.selectFrom(JUDGMENT)
            .from(TRANSACTION)
            .where(conditions)
            .orderBy(JUDGMENT.computedAt.desc(), JUDGMENT.id.desc());
        if (pageable.isPaged()) {
            rows.offset(pageable.getOffset()).limit(pageable.getPageSize());
        }
        return PageableExecutionUtils.getPage(rows.fetch(), pageable,
            () -> queryFactory.select(JUDGMENT.count()).from(JUDGMENT, TRANSACTION).where(conditions).fetchOne());
    }

    /** 범위 셋 중 하나. history 는 거르지 않는다. */
    private static BooleanExpression scope(UUID transactionId, UUID runId, boolean history) {
        if (runId != null) {
            return JUDGMENT.runId.eq(runId);
        }
        if (history) {
            return null;
        }
        BooleanExpression current = JUDGMENT.id.eq(TRANSACTION.currentJudgmentId);
        return transactionId != null ? current : current.and(judgmentTarget(TRANSACTION));
    }

    @Override
    public List<LimitTagged> findCurrentLimitTagged(UUID userId, String bucket) {
        return queryFactory
            .select(Projections.constructor(LimitTagged.class,
                JUDGMENT.id, TRANSACTION.approvedAt, JUDGMENT.finalAmount, TRANSACTION.amount))
            .from(TRANSACTION, JUDGMENT)
            .where(
                JUDGMENT.id.eq(TRANSACTION.currentJudgmentId),
                TRANSACTION.userId.eq(userId),
                judgmentTarget(TRANSACTION),
                JUDGMENT.verdict.eq("AVAILABLE"),
                Expressions.stringTemplate("function('jsonb_extract_path_text', {0}, 'limit_bucket')", JUDGMENT.attributes)
                    .eq(bucket)
            )
            .fetch();
    }
}
