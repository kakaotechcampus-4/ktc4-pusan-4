package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.judgment.persistence.TransactionRecordEntity;
import com.ktc4.pusan4.judgment.persistence.TransactionRecordRepository;
import com.ktc4.pusan4.judgment.persistence.UploadBatchEntity;
import com.ktc4.pusan4.judgment.persistence.UploadBatchRepository;
import com.ktc4.pusan4.merchant.classify.ClassificationInput;
import com.ktc4.pusan4.merchant.classify.ClassificationResult;
import com.ktc4.pusan4.merchant.classify.MerchantClassifier;
import com.ktc4.pusan4.shared.UuidGenerator;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.transaction.api.ClassificationStatus;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.domain.NewTransaction;
import com.ktc4.pusan4.transaction.domain.NewUploadBatch;
import com.ktc4.pusan4.transaction.domain.UploadResult;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * 카드내역 업로드 (api.md 3.3). 요청 하나 = UploadBatch 하나 + 중복이 아닌 거래들 + 미분류 거래의 분류 검토.
 *
 * <p>순서: 사용자 잠금 → fileHash 중복(409) → naturalKey 중복 건너뛰기 → 분류 → 저장.
 * 전부 한 트랜잭션이다. 분류 실패는 업로드를 실패시키지 않고 미분류 + 분류 검토로 남긴다.
 * 판정에 들어가지 않는 거래(CANCELED_OFFSET·EXCLUDED)는 미분류여도 분류 검토를 만들지 않는다.
 * 사용자가 나중에 포함(B7)하면 그때 만든다.
 */
@Service
public class UploadService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    // Postgres 바인드 변수 한도(32767) 아래로 끊는다. 카드 명세서 한 장은 보통 수백 건이다.
    private static final int KEY_LOOKUP_CHUNK = 1_000;

    private final EntityManager entityManager;
    private final UploadBatchRepository batchRepository;
    private final TransactionRecordRepository transactionRepository;
    private final MerchantClassifier merchantClassifier;
    private final UuidGenerator uuidGenerator;
    private final Clock clock;

    public UploadService(
        EntityManager entityManager,
        UploadBatchRepository batchRepository,
        TransactionRecordRepository transactionRepository,
        MerchantClassifier merchantClassifier,
        UuidGenerator uuidGenerator,
        Clock clock
    ) {
        this.entityManager = entityManager;
        this.batchRepository = batchRepository;
        this.transactionRepository = transactionRepository;
        this.merchantClassifier = merchantClassifier;
        this.uuidGenerator = uuidGenerator;
        this.clock = clock;
    }

    @Transactional
    public UploadResult upload(UUID userId, NewUploadBatch input) {
        lockUser(userId);

        if (batchRepository.existsByUserIdAndFileHash(userId, input.fileHash())) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_FILE", "이미 업로드한 파일입니다.");
        }

        List<NewTransaction> fresh = dropDuplicates(userId, input.transactions());
        int skipped = input.transactions().size() - fresh.size();

        OffsetDateTime now = OffsetDateTime.now(clock.withZone(KST));
        UploadBatchEntity batch = new UploadBatchEntity(uuidGenerator.generate(), userId, input, now);
        entityManager.persist(batch);

        List<ClassificationResult> results = merchantClassifier.classifyAll(userId, fresh.stream()
            .map(transaction -> new ClassificationInput(transaction.merchantRaw(), transaction.bizNo()))
            .toList());

        int pending = 0;
        for (int i = 0; i < fresh.size(); i++) {
            ClassificationResult result = results.get(i);
            ClassificationStatus status = result.classified()
                ? ClassificationStatus.CLASSIFIED
                : ClassificationStatus.NEEDS_REVIEW;
            TransactionRecordEntity transaction = new TransactionRecordEntity(
                uuidGenerator.generate(), batch.id(), userId, fresh.get(i),
                result.merchantNorm(), result.merchantCategory(), status, now);
            entityManager.persist(transaction);
            if (status == ClassificationStatus.NEEDS_REVIEW && fresh.get(i).status() == SourceStatus.JUDGEABLE) {
                entityManager.persist(ClassificationReviewEntity.pending(uuidGenerator.generate(), transaction.id(), now));
                pending++;
            }
        }

        return new UploadResult(batch.id(), fresh.size(), skipped, pending, now);
    }

    /**
     * 같은 사용자의 업로드를 한 줄로 세운다. 잠그지 않으면 두 업로드가 같은 fileHash·naturalKey 를
     * 동시에 "없음"으로 보고 둘 다 INSERT 해 UNIQUE 위반이 500 으로 나간다.
     * 사용자가 없으면(탈퇴 직후 남은 토큰 등) UserService 와 같이 401 이다.
     */
    private void lockUser(UUID userId) {
        List<?> rows = entityManager.createNativeQuery("select id from app_user where id = :userId for update")
            .setParameter("userId", userId)
            .getResultList();
        if (rows.isEmpty()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "사용자를 찾을 수 없습니다.");
        }
    }

    /**
     * 이미 저장된 naturalKey 와, 같은 요청 안에서 앞서 나온 naturalKey 를 뺀다. 순서는 요청 순서를 지킨다.
     * 같은 요청 안의 반복도 UNIQUE(user_id, natural_key) 에 걸리므로 같은 규칙(건너뛰기)으로 센다.
     */
    private List<NewTransaction> dropDuplicates(UUID userId, List<NewTransaction> transactions) {
        Set<String> requested = new LinkedHashSet<>();
        transactions.forEach(transaction -> requested.add(transaction.naturalKey()));

        Set<String> seen = new HashSet<>();
        List<String> keys = new ArrayList<>(requested);
        for (int from = 0; from < keys.size(); from += KEY_LOOKUP_CHUNK) {
            seen.addAll(transactionRepository.findExistingNaturalKeys(
                userId, keys.subList(from, Math.min(from + KEY_LOOKUP_CHUNK, keys.size()))));
        }

        List<NewTransaction> fresh = new ArrayList<>();
        for (NewTransaction transaction : transactions) {
            if (seen.add(transaction.naturalKey())) {
                fresh.add(transaction);
            }
        }
        return fresh;
    }
}
