package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.merchant.api.ClassificationReviewStatus;
import com.ktc4.pusan4.transaction.domain.ClassificationReviewGroup;
import com.ktc4.pusan4.transaction.domain.ClassificationReviewItem;
import com.ktc4.pusan4.transaction.domain.ClassificationReviewResult;
import com.ktc4.pusan4.transaction.persistence.ClassificationReviewRepository.ReviewRow;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

    public ClassificationReviewService(ClassificationReviewRepository reviewRepository) {
        this.reviewRepository = reviewRepository;
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
