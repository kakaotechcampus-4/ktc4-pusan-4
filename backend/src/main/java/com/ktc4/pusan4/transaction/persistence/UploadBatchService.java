package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.judgment.persistence.UploadBatchEntity;
import com.ktc4.pusan4.judgment.persistence.UploadBatchRepository;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.transaction.domain.UploadBatchSummary;
import com.ktc4.pusan4.transaction.persistence.UploadBatchCountRepository.BatchCount;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 업로드 배치 조회·삭제 (api.md 3.3). 남의 batch 는 없는 batch 와 똑같이 404 BATCH_NOT_FOUND 다.
 */
@Service
public class UploadBatchService {

    private final UploadBatchRepository batchRepository;
    private final UploadBatchCountRepository countRepository;

    public UploadBatchService(UploadBatchRepository batchRepository, UploadBatchCountRepository countRepository) {
        this.batchRepository = batchRepository;
        this.countRepository = countRepository;
    }

    @Transactional(readOnly = true)
    public Page<UploadBatchSummary> list(UUID userId, int page, int size) {
        Page<UploadBatchEntity> batches =
            batchRepository.findByUserIdOrderByCreatedAtDescIdDesc(userId, PageRequest.of(page, size));
        return new PageImpl<>(summarize(batches.getContent()), batches.getPageable(), batches.getTotalElements());
    }

    @Transactional(readOnly = true)
    public UploadBatchSummary get(UUID userId, UUID batchId) {
        UploadBatchEntity batch = batchRepository.findByIdAndUserId(batchId, userId)
            .orElseThrow(UploadBatchService::batchNotFound);
        return summarize(List.of(batch)).getFirst();
    }

    /** batch 와 그 업로드에서 파생된 데이터를 지운다(api.md 3.3, §6). 지우는 일은 DB 의 CASCADE 가 한다. */
    @Transactional
    public void delete(UUID userId, UUID batchId) {
        if (batchRepository.deleteOwned(batchId, userId) == 0) {
            throw batchNotFound();
        }
    }

    private List<UploadBatchSummary> summarize(List<UploadBatchEntity> batches) {
        if (batches.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = batches.stream().map(UploadBatchEntity::id).toList();
        Map<UUID, Long> transactions = byBatch(countRepository.countTransactions(ids));
        Map<UUID, Long> pending = byBatch(countRepository.countPendingReviews(ids));
        return batches.stream()
            .map(batch -> batch.toSummary(
                transactions.getOrDefault(batch.id(), 0L).intValue(),
                pending.getOrDefault(batch.id(), 0L).intValue()))
            .toList();
    }

    private static Map<UUID, Long> byBatch(List<BatchCount> counts) {
        return counts.stream().collect(Collectors.toMap(BatchCount::batchId, BatchCount::count));
    }

    private static ApiException batchNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "BATCH_NOT_FOUND", "업로드를 찾을 수 없습니다.");
    }
}
