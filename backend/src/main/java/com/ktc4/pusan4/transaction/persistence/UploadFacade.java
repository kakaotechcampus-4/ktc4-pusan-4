package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.judgment.persistence.UploadBatchRepository;
import com.ktc4.pusan4.merchant.classify.ClassificationInput;
import com.ktc4.pusan4.merchant.classify.ClassificationResult;
import com.ktc4.pusan4.merchant.classify.MerchantClassifier;
import com.ktc4.pusan4.merchant.classify.ModelClassifier;
import com.ktc4.pusan4.merchant.classify.ModelDecision;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.domain.NewTransaction;
import com.ktc4.pusan4.transaction.domain.NewUploadBatch;
import com.ktc4.pusan4.transaction.domain.UploadResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 업로드 앞에서 규칙으로 못 잡은 가맹점을 분류 모델에 묻는다 (B10).
 *
 * <p>트랜잭션을 열지 않는다. 모델을 기다리는 동안 사용자 잠금과 DB 커넥션을 잡지 않으려는 것이다.
 * 모델이 꺼져 있거나, 재전송·중복 파일이라 저장하지 않을 요청이면 부르지 않는다.
 * 모델이 실패하면 빈 답으로 업로드하므로 결과는 모델이 없을 때와 같다.
 */
@Service
public class UploadFacade {

    private static final Logger log = LoggerFactory.getLogger(UploadFacade.class);

    private final boolean enabled;
    private final int maxMerchants;
    private final UploadService uploadService;
    private final IdempotencyKeyRepository idempotencyKeyRepository;
    private final UploadBatchRepository batchRepository;
    private final MerchantClassifier merchantClassifier;
    private final ModelClassifier modelClassifier;
    private final Clock clock;

    public UploadFacade(
        @Value("${app.classify.enabled}") boolean enabled,
        @Value("${app.classify.max-merchants}") int maxMerchants,
        UploadService uploadService,
        IdempotencyKeyRepository idempotencyKeyRepository,
        UploadBatchRepository batchRepository,
        MerchantClassifier merchantClassifier,
        ModelClassifier modelClassifier,
        Clock clock
    ) {
        this.enabled = enabled;
        this.maxMerchants = maxMerchants;
        this.uploadService = uploadService;
        this.idempotencyKeyRepository = idempotencyKeyRepository;
        this.batchRepository = batchRepository;
        this.merchantClassifier = merchantClassifier;
        this.modelClassifier = modelClassifier;
        this.clock = clock;
    }

    public UploadResult upload(UUID userId, String idempotencyKey, NewUploadBatch input) {
        Map<String, ModelDecision> decisions = enabled && !skipsStore(userId, idempotencyKey, input)
            ? askModel(userId, input.transactions())
            : Map.of();
        return uploadService.upload(userId, idempotencyKey, input, decisions);
    }

    /**
     * 살아 있는 키가 있으면 재전송(또는 409·410)이고, 같은 fileHash 가 있으면 409 라 저장하지 않는다.
     * 잠금 없이 보므로 동시 요청은 놓칠 수 있다. 그때는 모델을 한 번 더 부를 뿐 결과는 같다.
     */
    private boolean skipsStore(UUID userId, String idempotencyKey, NewUploadBatch input) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        return idempotencyKeyRepository.findByUserIdAndKey(userId, idempotencyKey)
            .filter(key -> !key.expiredAt(now))
            .isPresent()
            || batchRepository.existsByUserIdAndFileHash(userId, input.fileHash());
    }

    /** 판정에 절대 들어가지 않는 취소상계만 뺀다. 제외(EXCLUDED) 거래는 사용자가 나중에 포함할 수 있어 보낸다. */
    private Map<String, ModelDecision> askModel(UUID userId, List<NewTransaction> transactions) {
        List<ClassificationResult> results = merchantClassifier.classifyAll(userId, transactions.stream()
            .map(transaction -> new ClassificationInput(transaction.merchantRaw(), transaction.bizNo()))
            .toList());
        Map<String, ModelClassifier.Merchant> merchants = new LinkedHashMap<>();
        for (int i = 0; i < transactions.size() && merchants.size() < maxMerchants; i++) {
            ClassificationResult result = results.get(i);
            if (!result.classified() && !result.merchantNorm().isEmpty()
                && transactions.get(i).status() != SourceStatus.CANCELED_OFFSET) {
                merchants.putIfAbsent(result.merchantNorm(),
                    new ModelClassifier.Merchant(result.merchantNorm(), transactions.get(i).merchantRaw()));
            }
        }
        if (merchants.isEmpty()) {
            return Map.of();
        }

        Map<String, ModelDecision> decisions = modelClassifier.classify(new ArrayList<>(merchants.values()));
        log.info("분류 모델: 가맹점 {}개 보냄, 실패 {}", merchants.size(), merchants.size() - decisions.size());
        return decisions;
    }
}
