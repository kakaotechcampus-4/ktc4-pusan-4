package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentOrigin;
import com.ktc4.pusan4.judgment.domain.JudgmentOriginType;
import com.ktc4.pusan4.judgment.persistence.JudgmentExecutor;
import com.ktc4.pusan4.judgment.persistence.TransactionRecordEntity;
import com.ktc4.pusan4.judgment.persistence.TransactionRecordRepository;
import com.ktc4.pusan4.merchant.MerchantCategoryVocabulary;
import com.ktc4.pusan4.merchant.MerchantDictionaryRepository;
import com.ktc4.pusan4.merchant.api.ClassificationReviewStatus;
import com.ktc4.pusan4.merchant.classify.ClassificationResult;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.domain.ClassificationAnswer;
import com.ktc4.pusan4.transaction.domain.ClassificationReviewGroup;
import com.ktc4.pusan4.transaction.domain.ClassificationReviewItem;
import com.ktc4.pusan4.transaction.domain.ClassificationReviewResult;
import com.ktc4.pusan4.transaction.persistence.ClassificationReviewRepository.ReviewRow;
import com.ktc4.pusan4.user.domain.BusinessContext;
import com.ktc4.pusan4.user.persistence.BusinessContextService;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * 가맹점 분류 확인 (api.md 3.5).
 *
 * <p>batch 의 분류 확인 요청을 한 번에 읽어 메모리에서 거르고 자른다. 미분류 거래만 요청이 생겨 batch 당 수가 작고,
 * grouped 의 page·size 가 그룹 단위라 SQL 로 자르기 어렵다. 미해소 집계도 같은 행에서 센다.
 */
@Service
public class ClassificationReviewService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    // UUID.compareTo 는 부호 있는 비교라 DB(uuid) 순서와 다를 수 있다. 문자열 비교는 DB 와 같다.
    private static final Comparator<ClassificationReviewItem> TRANSACTION_ORDER = Comparator
        .comparing(ClassificationReviewItem::approvedAt)
        .thenComparing(item -> item.transactionId().toString());

    private final ClassificationReviewRepository reviewRepository;
    private final TransactionRecordRepository transactionRepository;
    private final MerchantDictionaryRepository dictionaryRepository;
    private final MerchantCategoryVocabulary vocabulary;
    private final BusinessContextService contextService;
    private final JudgmentExecutor executor;
    private final Clock clock;

    public ClassificationReviewService(
        ClassificationReviewRepository reviewRepository,
        TransactionRecordRepository transactionRepository,
        MerchantDictionaryRepository dictionaryRepository,
        MerchantCategoryVocabulary vocabulary,
        BusinessContextService contextService,
        JudgmentExecutor executor,
        Clock clock
    ) {
        this.reviewRepository = reviewRepository;
        this.transactionRepository = transactionRepository;
        this.dictionaryRepository = dictionaryRepository;
        this.vocabulary = vocabulary;
        this.contextService = contextService;
        this.executor = executor;
        this.clock = clock;
    }

    /**
     * 분류 확인 요청을 한 카테고리로 해결한다 (api.md 3.5). 거래 분류를 확정하고, 답을 개인 사전에 남긴다.
     * batch 에 완료된 판정 실행이 있으면 그 run 의 문진 버전으로, 해결한 거래 중 판정 대상만 다시 판정한다.
     * 남의 요청은 없는 요청과 똑같이 404 다. 한 건이라도 실패하면 아무것도 바꾸지 않는다.
     */
    @Transactional
    public ClassificationAnswer answer(UUID userId, List<UUID> reviewIds, String category) {
        if (ClassificationResult.UNCLASSIFIED.equals(category)) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "UNCLASSIFIED_CATEGORY_NOT_ALLOWED",
                "「미분류」는 답변으로 제출할 수 없습니다.");
        }
        if (!vocabulary.contains(category)) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_MERCHANT_CATEGORY",
                "허용하지 않는 가맹점 카테고리입니다.");
        }

        Set<UUID> ids = new LinkedHashSet<>(reviewIds);
        Map<UUID, ClassificationReviewEntity> reviews = new HashMap<>();
        reviewRepository.findAllForUpdate(ids).forEach(review -> reviews.put(review.id(), review));
        Map<UUID, TransactionRecordEntity> transactions = new LinkedHashMap<>();
        ids.forEach(id -> transactions.put(id, lockOwnedTransaction(userId, reviews.get(id))));
        Set<UUID> batchIds = new HashSet<>();
        transactions.values().forEach(transaction -> batchIds.add(transaction.toDetail().batchId()));
        if (batchIds.size() > 1) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "REVIEWS_FROM_DIFFERENT_BATCHES",
                "서로 다른 배치의 항목은 함께 답할 수 없습니다.");
        }
        if (reviews.values().stream().anyMatch(ClassificationReviewEntity::resolved)) {
            throw new ApiException(HttpStatus.CONFLICT, "CLASSIFICATION_ALREADY_RESOLVED",
                "이미 분류를 확인한 항목이 있습니다.");
        }

        OffsetDateTime now = OffsetDateTime.now(clock.withZone(KST)).truncatedTo(ChronoUnit.MICROS);
        Set<String> merchantNorms = new LinkedHashSet<>();
        transactions.forEach((reviewId, transaction) -> {
            reviews.get(reviewId).resolve(category, now);
            transaction.classify(category);
            merchantNorms.add(transaction.merchantNorm());
        });
        merchantNorms.forEach(merchantNorm -> dictionaryRepository.savePersonal(userId, merchantNorm, category, now));

        int judged = rejudge(userId, batchIds.iterator().next(), transactions);
        return new ClassificationAnswer(ids.size(), category, judged);
    }

    /** 요청의 거래를 잠근다. 요청이 없거나 남의 거래면 404 다. */
    private TransactionRecordEntity lockOwnedTransaction(UUID userId, ClassificationReviewEntity review) {
        return Optional.ofNullable(review)
            .flatMap(found -> transactionRepository.findByIdForUpdate(found.transactionId()))
            .filter(transaction -> transaction.userId().equals(userId))
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CLASSIFICATION_REVIEW_NOT_FOUND",
                "분류 확인 항목을 찾을 수 없습니다."));
    }

    /** 판정 대상(effectiveStatus = JUDGEABLE)만 다시 판정한다. origin 은 거래마다 그 거래의 분류 확인 요청이다. */
    private int rejudge(UUID userId, UUID batchId, Map<UUID, TransactionRecordEntity> transactions) {
        Optional<Integer> contextVersion = reviewRepository.findLatestCompletedRunContextVersion(batchId);
        if (contextVersion.isEmpty()) {
            return 0;
        }
        BusinessContext context = contextService.version(userId, contextVersion.get());
        int judged = 0;
        for (Map.Entry<UUID, TransactionRecordEntity> entry : transactions.entrySet()) {
            if (entry.getValue().toDetail().effectiveStatus() == SourceStatus.JUDGEABLE) {
                executor.judge(entry.getValue().id(), context,
                    new JudgmentOrigin(JudgmentOriginType.CLASSIFICATION_REVIEW, entry.getKey()));
                judged++;
            }
        }
        return judged;
    }

    /** 정렬: createdAt ASC, id ASC. */
    @Transactional(readOnly = true)
    public ClassificationReviewResult<ClassificationReviewItem> list(
        UUID userId, UUID batchId, ClassificationReviewStatus status, int page, int size
    ) {
        List<ClassificationReviewItem> all = items(userId, batchId);
        return result(all, filter(all, status), page, size);
    }

    /** 같은 merchantNorm 끼리 묶는다. 그룹 순서는 그룹의 첫 요청 순서(createdAt ASC, id ASC)다. */
    @Transactional(readOnly = true)
    public ClassificationReviewResult<ClassificationReviewGroup> groups(
        UUID userId, UUID batchId, ClassificationReviewStatus status, int page, int size
    ) {
        List<ClassificationReviewItem> all = items(userId, batchId);
        Map<String, List<ClassificationReviewItem>> byMerchant = new LinkedHashMap<>();
        filter(all, status).forEach(item ->
            byMerchant.computeIfAbsent(item.merchantNorm(), key -> new ArrayList<>()).add(item));
        List<ClassificationReviewGroup> groups = byMerchant.entrySet().stream()
            .map(entry -> new ClassificationReviewGroup("merchant:" + entry.getKey(), entry.getKey(),
                entry.getValue().stream().sorted(TRANSACTION_ORDER).toList()))
            .toList();
        return result(all, groups, page, size);
    }

    private List<ClassificationReviewItem> items(UUID userId, UUID batchId) {
        List<ReviewRow> rows = batchId == null
            ? reviewRepository.findRows(userId)
            : reviewRepository.findRows(userId, batchId);
        return rows.stream().map(ClassificationReviewService::toItem).toList();
    }

    private static List<ClassificationReviewItem> filter(
        List<ClassificationReviewItem> items, ClassificationReviewStatus status
    ) {
        return status == null ? items : items.stream().filter(item -> item.status() == status).toList();
    }

    /** 미해소 집계는 status·page 와 무관하게 batch 의 PENDING 전부를 센다. */
    private static <T> ClassificationReviewResult<T> result(
        List<ClassificationReviewItem> all, List<T> content, int page, int size
    ) {
        List<ClassificationReviewItem> pending = filter(all, ClassificationReviewStatus.PENDING);
        int from = (int) Math.min((long) page * size, content.size());
        int to = Math.min(from + size, content.size());
        return new ClassificationReviewResult<>(
            new PageImpl<>(content.subList(from, to), PageRequest.of(page, size), content.size()),
            pending.size(),
            pending.stream().mapToLong(ClassificationReviewItem::amount).sum());
    }

    /** DB 에서 읽은 timestamptz 는 UTC 로 오므로 api.md 1.2 의 KST 표기로 되돌린다. */
    private static ClassificationReviewItem toItem(ReviewRow row) {
        return new ClassificationReviewItem(row.reviewId(), row.batchId(), row.transactionId(),
            ClassificationReviewStatus.valueOf(row.status()), row.createdAt().atZoneSameInstant(KST).toOffsetDateTime(),
            row.resolvedAt() == null ? null : row.resolvedAt().atZoneSameInstant(KST).toOffsetDateTime(),
            row.approvedAt(), row.merchantRaw(), row.merchantNorm(), row.merchantCategory(), row.amount(),
            row.installmentMonths());
    }
}
