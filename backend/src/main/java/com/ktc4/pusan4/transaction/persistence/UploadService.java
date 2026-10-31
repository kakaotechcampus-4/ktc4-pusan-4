package com.ktc4.pusan4.transaction.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ktc4.pusan4.judgment.persistence.TransactionRecordEntity;
import com.ktc4.pusan4.judgment.persistence.TransactionRecordRepository;
import com.ktc4.pusan4.judgment.persistence.UploadBatchEntity;
import com.ktc4.pusan4.judgment.persistence.UploadBatchRepository;
import com.ktc4.pusan4.merchant.classify.ClassificationInput;
import com.ktc4.pusan4.merchant.classify.ClassificationResult;
import com.ktc4.pusan4.merchant.classify.MerchantClassifier;
import com.ktc4.pusan4.merchant.classify.ModelDecision;
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

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 카드내역 업로드 (api.md 3.3). 요청 하나 = UploadBatch 하나 + 중복이 아닌 거래들 + 미분류 거래의 분류 검토.
 *
 * <p>순서: 사용자 잠금 → Idempotency-Key(api.md 1.6) → fileHash 중복(409) → naturalKey 중복 건너뛰기 → 분류 → 저장 → 키에 응답 기록.
 * 전부 한 트랜잭션이다. 키 기록이 실패하면 업로드도 되돌아가고, 업로드가 실패하면 키도 남지 않는다.
 * 분류 실패는 업로드를 실패시키지 않고 미분류 + 분류 검토로 남긴다.
 * 판정에 들어가지 않는 거래(CANCELED_OFFSET·EXCLUDED)는 미분류여도 분류 검토를 만들지 않는다.
 * 사용자가 나중에 포함(B7)하면 그때 만든다.
 * 규칙으로 미분류인 거래에 분류 모델 답({@link UploadFacade} 가 트랜잭션 밖에서 받아 온다)이 있으면 그 답을 남긴다.
 * 모델 답은 분류 검토의 후보로만 쓰고 카테고리는 바꾸지 않는다.
 */
@Service
public class UploadService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    // Postgres 바인드 변수 한도(32767) 아래로 끊는다. 카드 명세서 한 장은 보통 수백 건이다.
    private static final int KEY_LOOKUP_CHUNK = 1_000;
    private static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24);

    private final EntityManager entityManager;
    private final UploadBatchRepository batchRepository;
    private final TransactionRecordRepository transactionRepository;
    private final IdempotencyKeyRepository idempotencyKeyRepository;
    private final MerchantClassifier merchantClassifier;
    private final ObjectMapper objectMapper;
    private final UuidGenerator uuidGenerator;
    private final Clock clock;
    private final UserWriteLock userWriteLock;

    public UploadService(
        EntityManager entityManager,
        UploadBatchRepository batchRepository,
        TransactionRecordRepository transactionRepository,
        IdempotencyKeyRepository idempotencyKeyRepository,
        MerchantClassifier merchantClassifier,
        ObjectMapper objectMapper,
        UuidGenerator uuidGenerator,
        Clock clock,
        UserWriteLock userWriteLock
    ) {
        this.entityManager = entityManager;
        this.batchRepository = batchRepository;
        this.transactionRepository = transactionRepository;
        this.idempotencyKeyRepository = idempotencyKeyRepository;
        this.merchantClassifier = merchantClassifier;
        this.objectMapper = objectMapper;
        this.uuidGenerator = uuidGenerator;
        this.clock = clock;
        this.userWriteLock = userWriteLock;
    }

    /** 분류 모델 없이 업로드한다. */
    @Transactional
    public UploadResult upload(UUID userId, String idempotencyKey, NewUploadBatch input) {
        return upload(userId, idempotencyKey, input, Map.of());
    }

    /**
     * @param idempotencyKey 헤더 값. 빈 값 검사(400 IDEMPOTENCY_KEY_REQUIRED)는 컨트롤러가 먼저 한다
     * @param decisions      merchantNorm → 분류 모델 답. 규칙으로 미분류인 거래에만 쓴다
     */
    @Transactional
    public UploadResult upload(
        UUID userId, String idempotencyKey, NewUploadBatch input, Map<String, ModelDecision> decisions
    ) {
        userWriteLock.lock(userId);
        // DB(timestamptz)가 마이크로초까지라 맞춰 자른다. 그래야 재전송 응답의 createdAt 이 최초 응답과 글자까지 같다.
        OffsetDateTime now = OffsetDateTime.now(clock.withZone(KST)).truncatedTo(ChronoUnit.MICROS);
        String requestHash = hash(input);

        // 사용자 잠금 뒤에 찾는다. 같은 키로 동시에 온 두 요청 중 뒤의 것은 앞의 것이 커밋한 행을 본다.
        IdempotencyKeyEntity key = idempotencyKeyRepository.findByUserIdAndKey(userId, idempotencyKey).orElse(null);
        if (key != null && !key.expiredAt(now)) {
            if (!key.sameRequest(requestHash)) {
                throw new ApiException(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_REUSED",
                    "같은 Idempotency-Key 로 다른 요청을 보냈습니다.");
            }
            if (key.batchDeleted()) {
                throw new ApiException(HttpStatus.GONE, "IDEMPOTENCY_RESULT_DELETED",
                    "이 요청으로 만든 업로드가 삭제되었습니다. 다시 올리려면 새 Idempotency-Key 를 쓰세요.");
            }
            return key.replay();
        }

        UploadResult result = store(userId, input, decisions, now);

        // 만료된 키는 새 요청으로 처리한다(api.md 1.6). UNIQUE(user_id, key) 라 같은 행에 덮어쓴다.
        if (key == null) {
            key = new IdempotencyKeyEntity(uuidGenerator.generate(), userId, idempotencyKey);
            key.record(requestHash, result, now.plus(IDEMPOTENCY_TTL));
            entityManager.persist(key);
        } else {
            key.record(requestHash, result, now.plus(IDEMPOTENCY_TTL));
        }
        return result;
    }

    private UploadResult store(
        UUID userId, NewUploadBatch input, Map<String, ModelDecision> decisions, OffsetDateTime now
    ) {
        if (batchRepository.existsByUserIdAndFileHash(userId, input.fileHash())) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_FILE", "이미 업로드한 파일입니다.");
        }

        List<NewTransaction> fresh = dropDuplicates(userId, input.transactions());
        int skipped = input.transactions().size() - fresh.size();

        UploadBatchEntity batch = new UploadBatchEntity(uuidGenerator.generate(), userId, input, skipped, now);
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
            // 모델을 부른 뒤 사전이 바뀌어 규칙으로 분류됐으면 모델 답은 남기지 않는다
            ModelDecision decision = result.classified() ? null : decisions.get(result.merchantNorm());
            if (decision != null) {
                entityManager.persist(new MerchantModelDecisionEntity(transaction.id(), decision, now));
            }
            if (status == ClassificationStatus.NEEDS_REVIEW && fresh.get(i).status() == SourceStatus.JUDGEABLE) {
                entityManager.persist(ClassificationReviewEntity.pending(uuidGenerator.generate(), transaction.id(), now));
                pending++;
            }
        }

        return new UploadResult(batch.id(), fresh.size(), skipped, pending, now);
    }

    /**
     * 정규화한 요청의 SHA-256. 원문 JSON 이 아니라 파싱한 값을 다시 직렬화하므로
     * 필드 순서·공백·생략된 선택값(null 과 기본값)이 달라도 같은 요청이면 같은 해시다.
     */
    private String hash(NewUploadBatch input) {
        try {
            byte[] canonical = objectMapper.writeValueAsBytes(input);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical));
        } catch (JsonProcessingException | NoSuchAlgorithmException e) {
            throw new IllegalStateException("업로드 요청을 해시할 수 없습니다.", e);
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
