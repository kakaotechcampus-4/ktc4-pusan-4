package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.judgment.persistence.QJudgmentEntity;
import com.ktc4.pusan4.judgment.persistence.QTransactionRecordEntity;
import com.ktc4.pusan4.judgment.persistence.TransactionRecordEntity;
import com.ktc4.pusan4.transaction.domain.TransactionFilter;
import com.querydsl.core.types.Predicate;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.JPAExpressions;
import com.querydsl.jpa.impl.JPAQueryFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.support.PageableExecutionUtils;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static com.ktc4.pusan4.judgment.persistence.TransactionConditions.effectiveStatusIs;
import static com.ktc4.pusan4.judgment.persistence.TransactionConditions.judgmentTarget;

/**
 * 주어진 조건만 붙여 거래 목록을 읽는다. 비어 있는 조건은 Java 에서 빼므로
 * "값이 null 이면 무시" 를 SQL 에 쓰다 생기던 null 파라미터 타입 문제(#132 의 42P18)가 없다.
 */
@Repository
class TransactionQueryRepositoryImpl implements TransactionQueryRepository {

    private static final QTransactionRecordEntity TRANSACTION = new QTransactionRecordEntity("transaction");
    private static final QJudgmentEntity JUDGMENT = new QJudgmentEntity("judgment");

    private final JPAQueryFactory queryFactory;

    TransactionQueryRepositoryImpl(JPAQueryFactory queryFactory) {
        this.queryFactory = queryFactory;
    }

    @Override
    public Page<TransactionRecordEntity> findPage(UUID userId, TransactionFilter filter, Pageable pageable) {
        Predicate[] conditions = {
            TRANSACTION.userId.eq(userId),
            filter.batchId() == null ? null : TRANSACTION.batchId.eq(filter.batchId()),
            approvedAt(filter.year(), filter.month()),
            filter.status() == null ? null : effectiveStatusIs(TRANSACTION, filter.status()),
            filter.classificationStatus() == null
                ? null : TRANSACTION.classificationStatus.eq(filter.classificationStatus().name()),
            filter.verdict() == null ? null : currentVerdict(filter.verdict().name()),
        };
        List<TransactionRecordEntity> rows = queryFactory.selectFrom(TRANSACTION)
            .where(conditions)
            .orderBy(TRANSACTION.approvedAt.desc(), TRANSACTION.id.desc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch();
        return PageableExecutionUtils.getPage(rows, pageable,
            () -> queryFactory.select(TRANSACTION.count()).from(TRANSACTION).where(conditions).fetchOne());
    }

    /**
     * 현재 결과(api.md §5)는 두 단계다. 지금 판정 대상인 거래(제외·미분류가 아닌 거래)만 남기고, 거래가 가리키는
     * 현재 판정(transaction.current_judgment_id)의 verdict 를 본다. 그래야 GET /judgments·summary(#132·#133)의 건수와
     * verdict 로 거른 거래 목록의 건수가 같다(#148 리뷰).
     */
    private static BooleanExpression currentVerdict(String verdict) {
        return judgmentTarget(TRANSACTION).and(JPAExpressions.selectOne()
            .from(JUDGMENT)
            .where(JUDGMENT.id.eq(TRANSACTION.currentJudgmentId), JUDGMENT.verdict.eq(verdict))
            .exists());
    }

    /**
     * 연도가 있으면 approved_at 범위로 건다. extract 로 걸면 (user_id, approved_at) 인덱스를 타지 못한다(#132 와 같은 방식).
     * month 만 오면 모든 해의 그 달이라 범위로 바꿀 수 없어 월을 꺼내 비교한다.
     */
    private static BooleanExpression approvedAt(Integer year, Integer month) {
        if (year != null) {
            LocalDate from = month != null ? LocalDate.of(year, month, 1) : LocalDate.of(year, 1, 1);
            LocalDate to = month != null ? from.plusMonths(1) : from.plusYears(1);
            return TRANSACTION.approvedAt.goe(from).and(TRANSACTION.approvedAt.lt(to));
        }
        return month == null ? null : TRANSACTION.approvedAt.month().eq(month);
    }
}
