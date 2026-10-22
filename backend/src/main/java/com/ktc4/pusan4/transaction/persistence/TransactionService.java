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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * 거래 조회와 판정 대상 포함·제외 (api.md 3.4). 남의 거래는 없는 거래와 똑같이 404 TRANSACTION_NOT_FOUND 다.
 */
@Service
public class TransactionService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final EntityManager entityManager;
    private final TransactionRecordRepository transactionRepository;
    private final TransactionQueryRepository queryRepository;
    private final ClassificationReviewRepository reviewRepository;
    private final UuidGenerator uuidGenerator;
    private final Clock clock;

    public TransactionService(
        EntityManager entityManager,
        TransactionRecordRepository transactionRepository,
        TransactionQueryRepository queryRepository,
        ClassificationReviewRepository reviewRepository,
        UuidGenerator uuidGenerator,
        Clock clock
    ) {
        this.entityManager = entityManager;
        this.transactionRepository = transactionRepository;
        this.queryRepository = queryRepository;
        this.reviewRepository = reviewRepository;
        this.uuidGenerator = uuidGenerator;
        this.clock = clock;
    }

    /** 정렬: approvedAt DESC, id DESC. 조건은 TransactionQueryRepository 가 SQL 로 만든다. */
    @Transactional(readOnly = true)
    public Page<TransactionDetail> list(UUID userId, TransactionFilter filter, int page, int size) {
        return queryRepository.findPage(userId, filter, PageRequest.of(page, size))
            .map(TransactionRecordEntity::toDetail);
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
