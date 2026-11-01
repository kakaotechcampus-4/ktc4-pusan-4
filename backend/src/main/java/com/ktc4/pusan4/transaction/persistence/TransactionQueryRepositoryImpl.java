package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.judgment.persistence.TransactionRecordEntity;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.domain.TransactionFilter;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 주어진 조건만 붙인 네이티브 SQL 로 거래 목록을 읽는다.
 * "값이 null 이면 무시" 를 SQL 안에 쓰면 Postgres 가 null 파라미터의 타입을 정하지 못하는 경우가 있다(#132 의 42P18).
 */
@Repository
class TransactionQueryRepositoryImpl implements TransactionQueryRepository {

    // effectiveStatus(api.md 2.3) 를 sourceStatus·userInclusion 으로 푼 조건. TransactionDetail.effectiveStatus 와 같다.
    // 판정 대상 조건이 여러 쿼리에 복사돼 있어 #162 에서 한 곳으로 모은다.
    private static final Map<SourceStatus, String> EFFECTIVE_STATUS = Map.of(
        SourceStatus.JUDGEABLE, """
            ((t.source_status = 'JUDGEABLE' and t.user_inclusion <> 'EXCLUDED')
              or (t.source_status = 'EXCLUDED' and t.user_inclusion = 'INCLUDED'))""",
        SourceStatus.EXCLUDED, """
            ((t.source_status = 'JUDGEABLE' and t.user_inclusion = 'EXCLUDED')
              or (t.source_status = 'EXCLUDED' and t.user_inclusion <> 'INCLUDED'))""",
        SourceStatus.CANCELED_OFFSET, "t.source_status = 'CANCELED_OFFSET'"
    );

    // 현재 결과(api.md §5)는 두 단계다. 거래마다 현재 판정을 하나 고르고, 지금 판정 대상이 아닌 거래(제외·미분류)를 뺀다.
    // 그래야 GET /judgments·summary(#132·#133)의 건수와 verdict 로 거른 거래 목록의 건수가 같다(#148 리뷰).
    private static final String JUDGMENT_TARGET =
        "t.classification_status = 'CLASSIFIED' and " + EFFECTIVE_STATUS.get(SourceStatus.JUDGEABLE);

    // 현재 판정(api.md §5): 활성 override 가 있으면 그 override revision, 없으면 override 가 아닌 최신 revision.
    // GET /judgments 의 현재 판정(JudgmentRepository.findPage, #132)과 같은 규칙이다.
    private static final String CURRENT_VERDICT = """
        exists (
          select 1 from judgment j
          where j.transaction_id = t.id
            and j.verdict = :verdict
            and (
              j.judgment_override_id = (
                select o.id from judgment_override o where o.transaction_id = t.id and o.active
              )
              or (
                not exists (select 1 from judgment_override o where o.transaction_id = t.id and o.active)
                and j.judgment_override_id is null
                and j.revision = (
                  select max(l.revision) from judgment l
                  where l.transaction_id = t.id and l.judgment_override_id is null
                )
              )
            )
        )""";

    private final EntityManager entityManager;

    TransactionQueryRepositoryImpl(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    public Page<TransactionRecordEntity> findPage(UUID userId, TransactionFilter filter, Pageable pageable) {
        Map<String, Object> params = new LinkedHashMap<>();
        StringBuilder where = new StringBuilder("where t.user_id = :userId");
        params.put("userId", userId);
        if (filter.batchId() != null) {
            where.append(" and t.batch_id = :batchId");
            params.put("batchId", filter.batchId());
        }
        appendApprovedAt(where, params, filter.year(), filter.month());
        if (filter.status() != null) {
            where.append(" and ").append(EFFECTIVE_STATUS.get(filter.status()));
        }
        if (filter.classificationStatus() != null) {
            where.append(" and t.classification_status = :classificationStatus");
            params.put("classificationStatus", filter.classificationStatus().name());
        }
        if (filter.verdict() != null) {
            where.append(" and ").append(JUDGMENT_TARGET).append(" and ").append(CURRENT_VERDICT);
            params.put("verdict", filter.verdict().name());
        }

        Query count = entityManager.createNativeQuery("select count(*) from transaction t " + where);
        Query rows = entityManager.createNativeQuery(
            "select t.* from transaction t " + where + " order by t.approved_at desc, t.id desc",
            TransactionRecordEntity.class);
        params.forEach((name, value) -> {
            count.setParameter(name, value);
            rows.setParameter(name, value);
        });
        long total = ((Number) count.getSingleResult()).longValue();
        rows.setFirstResult((int) pageable.getOffset());
        rows.setMaxResults(pageable.getPageSize());

        @SuppressWarnings("unchecked")
        List<TransactionRecordEntity> found = rows.getResultList();
        return new PageImpl<>(found, pageable, total);
    }

    /**
     * 연도가 있으면 approved_at 범위로 건다. extract 로 걸면 (user_id, approved_at) 인덱스를 타지 못한다(#132 와 같은 방식).
     * month 만 오면 모든 해의 그 달이라 범위로 바꿀 수 없어 extract 를 쓴다.
     */
    private static void appendApprovedAt(StringBuilder where, Map<String, Object> params, Integer year, Integer month) {
        if (year != null) {
            LocalDate from = month != null ? LocalDate.of(year, month, 1) : LocalDate.of(year, 1, 1);
            LocalDate to = month != null ? from.plusMonths(1) : from.plusYears(1);
            where.append(" and t.approved_at >= :approvedFrom and t.approved_at < :approvedTo");
            params.put("approvedFrom", from);
            params.put("approvedTo", to);
        } else if (month != null) {
            where.append(" and extract(month from t.approved_at) = :month");
            params.put("month", month);
        }
    }
}
