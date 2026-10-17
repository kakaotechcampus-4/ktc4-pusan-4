package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.judgment.persistence.TransactionRecordEntity;
import com.ktc4.pusan4.judgment.persistence.TransactionRecordRepository;
import com.ktc4.pusan4.shared.UuidGenerator;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.transaction.api.ClassificationStatus;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.api.UserInclusion;
import com.ktc4.pusan4.transaction.domain.TransactionDetail;
import com.ktc4.pusan4.transaction.domain.TransactionFilter;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 거래 조회와 판정 대상 포함·제외 (api.md 3.4). 남의 거래는 없는 거래와 똑같이 404 TRANSACTION_NOT_FOUND 다.
 */
@Service
public class TransactionService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    // effectiveStatus(api.md 2.3) 를 sourceStatus·userInclusion 으로 푼 조건. TransactionDetail.effectiveStatus 와 같다.
    private static final Map<SourceStatus, String> EFFECTIVE_STATUS = Map.of(
        SourceStatus.JUDGEABLE, """
            ((t.source_status = 'JUDGEABLE' and t.user_inclusion <> 'EXCLUDED')
              or (t.source_status = 'EXCLUDED' and t.user_inclusion = 'INCLUDED'))""",
        SourceStatus.EXCLUDED, """
            ((t.source_status = 'JUDGEABLE' and t.user_inclusion = 'EXCLUDED')
              or (t.source_status = 'EXCLUDED' and t.user_inclusion <> 'INCLUDED'))""",
        SourceStatus.CANCELED_OFFSET, "t.source_status = 'CANCELED_OFFSET'"
    );

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
    private final TransactionRecordRepository transactionRepository;
    private final ClassificationReviewRepository reviewRepository;
    private final UuidGenerator uuidGenerator;
    private final Clock clock;

    public TransactionService(
        EntityManager entityManager,
        TransactionRecordRepository transactionRepository,
        ClassificationReviewRepository reviewRepository,
        UuidGenerator uuidGenerator,
        Clock clock
    ) {
        this.entityManager = entityManager;
        this.transactionRepository = transactionRepository;
        this.reviewRepository = reviewRepository;
        this.uuidGenerator = uuidGenerator;
        this.clock = clock;
    }

    /**
     * 정렬: approvedAt DESC, id DESC. 조건이 여섯 개이고 대부분 비어서 오므로, 주어진 조건만 붙인 SQL 을 만든다.
     * "값이 null 이면 무시" 를 SQL 안에 쓰면 Postgres 가 null 파라미터의 타입을 정하지 못하는 경우가 있다(#132 의 42P18).
     */
    @Transactional(readOnly = true)
    public Page<TransactionDetail> list(UUID userId, TransactionFilter filter, int page, int size) {
        Map<String, Object> params = new LinkedHashMap<>();
        StringBuilder where = new StringBuilder("where t.user_id = :userId");
        params.put("userId", userId);
        if (filter.batchId() != null) {
            where.append(" and t.batch_id = :batchId");
            params.put("batchId", filter.batchId());
        }
        if (filter.year() != null) {
            where.append(" and extract(year from t.approved_at) = :year");
            params.put("year", filter.year());
        }
        if (filter.month() != null) {
            where.append(" and extract(month from t.approved_at) = :month");
            params.put("month", filter.month());
        }
        if (filter.status() != null) {
            where.append(" and ").append(EFFECTIVE_STATUS.get(filter.status()));
        }
        if (filter.classificationStatus() != null) {
            where.append(" and t.classification_status = :classificationStatus");
            params.put("classificationStatus", filter.classificationStatus().name());
        }
        if (filter.verdict() != null) {
            where.append(" and ").append(CURRENT_VERDICT);
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
        rows.setFirstResult(page * size);
        rows.setMaxResults(size);

        @SuppressWarnings("unchecked")
        List<TransactionRecordEntity> found = rows.getResultList();
        return new PageImpl<>(found.stream().map(TransactionRecordEntity::toDetail).toList(),
            PageRequest.of(page, size), total);
    }

    @Transactional(readOnly = true)
    public TransactionDetail get(UUID userId, UUID transactionId) {
        return transactionRepository.findById(transactionId)
            .filter(transaction -> transaction.userId().equals(userId))
            .map(TransactionRecordEntity::toDetail)
            .orElseThrow(TransactionService::transactionNotFound);
    }

    /** userInclusion = EXCLUDED. 기존 판정과 분류 검토는 지우지 않는다(api.md 3.4). */
    @Transactional
    public TransactionDetail exclude(UUID userId, UUID transactionId) {
        TransactionRecordEntity transaction = lockOwned(userId, transactionId);
        transaction.changeInclusion(UserInclusion.EXCLUDED);
        return transaction.toDetail();
    }

    /**
     * userInclusion = INCLUDED. 취소상계는 포함할 수 없다(409).
     * 미분류인데 대기 중인 분류 검토가 없으면 지금 만든다. 업로드는 판정에 들어가지 않는 거래의 검토를 만들지 않는다(B4).
     */
    @Transactional
    public TransactionDetail include(UUID userId, UUID transactionId) {
        TransactionRecordEntity transaction = lockOwned(userId, transactionId);
        if (transaction.sourceStatus() == SourceStatus.CANCELED_OFFSET) {
            throw new ApiException(HttpStatus.CONFLICT, "CANCELED_TRANSACTION_NOT_INCLUDABLE",
                "취소·상계 거래는 판정 대상으로 포함할 수 없습니다.");
        }
        transaction.changeInclusion(UserInclusion.INCLUDED);
        if (ClassificationStatus.NEEDS_REVIEW.name().equals(transaction.classificationStatus())
            && !reviewRepository.existsByTransactionIdAndStatus(transaction.id(), "PENDING")) {
            OffsetDateTime now = OffsetDateTime.now(clock.withZone(KST)).truncatedTo(ChronoUnit.MICROS);
            entityManager.persist(ClassificationReviewEntity.pending(uuidGenerator.generate(), transaction.id(), now));
        }
        return transaction.toDetail();
    }

    /** 같은 거래의 포함·제외가 동시에 오면 한 줄로 세운다. 포함 쪽 분류 검토가 두 번 생기지 않는다. */
    private TransactionRecordEntity lockOwned(UUID userId, UUID transactionId) {
        return transactionRepository.findByIdForUpdate(transactionId)
            .filter(transaction -> transaction.userId().equals(userId))
            .orElseThrow(TransactionService::transactionNotFound);
    }

    private static ApiException transactionNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "TRANSACTION_NOT_FOUND", "요청한 거래를 찾을 수 없습니다.");
    }
}
