package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.QuestionStatus;
import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.judgment.persistence.JudgmentRepository.LimitTagged;
import com.querydsl.core.types.OrderSpecifier;
import com.querydsl.core.types.Predicate;
import com.querydsl.core.types.Projections;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.core.types.dsl.CaseBuilder;
import com.querydsl.core.types.dsl.Expressions;
import com.querydsl.jpa.JPAExpressions;
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
    private static final QQuestionQueueEntity PENDING_QUESTION = new QQuestionQueueEntity("pendingQuestion");
    private static final QJudgmentEntity ASKED_JUDGMENT = new QJudgmentEntity("askedJudgment");

    private final JPAQueryFactory queryFactory;

    JudgmentRepositoryCustomImpl(JPAQueryFactory queryFactory) {
        this.queryFactory = queryFactory;
    }

    @Override
    public Page<JudgmentEntity> findPage(UUID userId, JudgmentListQuery query, Pageable pageable) {
        Predicate[] conditions = conditions(userId, query);
        JPAQuery<JudgmentEntity> rows = queryFactory.selectFrom(JUDGMENT)
            .from(TRANSACTION)
            .where(conditions)
            .orderBy(query.sort() == JudgmentListQuery.Sort.APPROVED_AT
                ? new OrderSpecifier<?>[] {TRANSACTION.approvedAt.desc(), JUDGMENT.id.desc()}
                : new OrderSpecifier<?>[] {JUDGMENT.computedAt.desc(), JUDGMENT.id.desc()});
        if (pageable.isPaged()) {
            rows.offset(pageable.getOffset()).limit(pageable.getPageSize());
        }
        return PageableExecutionUtils.getPage(rows.fetch(), pageable,
            () -> queryFactory.select(JUDGMENT.count()).from(JUDGMENT, TRANSACTION).where(conditions).fetchOne());
    }

    @Override
    public List<SummaryRow> findSummaryRows(UUID userId, JudgmentListQuery query) {
        return queryFactory
            .select(Projections.constructor(SummaryRow.class,
                JUDGMENT.id, JUDGMENT.verdict, JUDGMENT.account, JUDGMENT.finalAmount, TRANSACTION.amount,
                new CaseBuilder().when(awaitingAnswer()).then(true).otherwise(false)))
            .from(JUDGMENT, TRANSACTION)
            .where(conditions(userId, query))
            .fetch();
    }

    private static Predicate[] conditions(UUID userId, JudgmentListQuery query) {
        LocalDate yearStart = query.year() == null ? null : LocalDate.of(query.year(), 1, 1);
        return new Predicate[] {
            TRANSACTION.id.eq(JUDGMENT.transactionId),
            TRANSACTION.userId.eq(userId),
            query.transactionId() == null ? null : TRANSACTION.id.eq(query.transactionId()),
            query.batchId() == null ? null : TRANSACTION.batchId.eq(query.batchId()),
            yearStart == null ? null
                : TRANSACTION.approvedAt.goe(yearStart).and(TRANSACTION.approvedAt.lt(yearStart.plusYears(1))),
            query.verdict() == null ? null : JUDGMENT.verdict.eq(query.verdict().name()),
            scope(query.transactionId(), query.runId(), !query.latestOnly()),
            query.awaiting() == null ? null : query.awaiting() ? awaitingAnswer() : awaitingAnswer().not(),
        };
    }

    /**
     * 답변 대기: 불가인데 그 거래에 답하지 않은 질문이 남았다. 질문은 revision 마다 생기므로 거래의 모든 판정에서 찾는다.
     * 질문 목록(api.md 3.9)이 판정 대상인 거래의 질문만 보이므로 여기도 판정 대상인 거래만 센다.
     */
    private static BooleanExpression awaitingAnswer() {
        return JUDGMENT.verdict.eq(Verdict.UNAVAILABLE.name())
            .and(judgmentTarget(TRANSACTION))
            .and(JPAExpressions.selectOne()
                .from(PENDING_QUESTION, ASKED_JUDGMENT)
                .where(PENDING_QUESTION.judgmentId.eq(ASKED_JUDGMENT.id),
                    ASKED_JUDGMENT.transactionId.eq(TRANSACTION.id),
                    PENDING_QUESTION.status.eq(QuestionStatus.PENDING.name()))
                .exists());
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
