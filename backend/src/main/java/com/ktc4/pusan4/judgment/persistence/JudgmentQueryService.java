package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentRevision;
import com.ktc4.pusan4.judgment.domain.JudgmentRevision.CitedStatute;
import com.ktc4.pusan4.judgment.domain.JudgmentSummary;
import com.ktc4.pusan4.judgment.persistence.JudgmentCitationRepository.CitationRow;
import com.ktc4.pusan4.shared.api.ApiException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 판정 조회 (api.md 3.7). 저장은 {@link JudgmentService} 가 한다.
 */
@Service
public class JudgmentQueryService {

    private final JudgmentRepository judgmentRepository;
    private final TransactionRecordRepository transactionRepository;
    private final JudgmentCitationRepository citationRepository;

    public JudgmentQueryService(
        JudgmentRepository judgmentRepository,
        TransactionRecordRepository transactionRepository,
        JudgmentCitationRepository citationRepository
    ) {
        this.judgmentRepository = judgmentRepository;
        this.transactionRepository = transactionRepository;
        this.citationRepository = citationRepository;
    }

    @Transactional(readOnly = true)
    public JudgmentRevision get(UUID userId, UUID judgmentId) {
        JudgmentEntity judgment = judgmentRepository.findForUser(judgmentId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "JUDGMENT_NOT_FOUND", "판정을 찾을 수 없습니다."));
        return toDomain(List.of(judgment)).getFirst();
    }

    @Transactional(readOnly = true)
    public Page<JudgmentRevision> list(UUID userId, JudgmentListQuery query, int page, int size) {
        Page<JudgmentEntity> judgments = find(userId, query, PageRequest.of(page, size));
        return new PageImpl<>(toDomain(judgments.getContent()), judgments.getPageable(), judgments.getTotalElements());
    }

    /**
     * batchId·year·runId 중 하나로 집계한다. 대상은 같은 조건의 목록과 같다
     * (batchId·year 는 현재 판정, runId 는 그 Run 이 만든 판정).
     */
    @Transactional(readOnly = true)
    public JudgmentSummary summary(UUID userId, UUID batchId, Integer year, UUID runId) {
        JudgmentListQuery query = new JudgmentListQuery(null, batchId, year, null, true, runId);
        return JudgmentSummary.of(find(userId, query, Pageable.unpaged()).stream()
            .map(JudgmentEntity::toSummaryRow)
            .toList());
    }

    private Page<JudgmentEntity> find(UUID userId, JudgmentListQuery query, Pageable pageable) {
        LocalDate yearStart = query.year() == null ? null : LocalDate.of(query.year(), 1, 1);
        return judgmentRepository.findPage(userId, query.transactionId(), query.batchId(),
            yearStart, yearStart == null ? null : yearStart.plusYears(1),
            query.verdict() == null ? null : query.verdict().name(),
            query.runId(), !query.latestOnly(), pageable);
    }

    /** 거래와 인용을 판정마다 따로 읽지 않도록 한 번에 읽어 붙인다. */
    private List<JudgmentRevision> toDomain(List<JudgmentEntity> judgments) {
        Map<UUID, TransactionRecordEntity> transactions = transactionRepository
            .findByIdIn(judgments.stream().map(JudgmentEntity::transactionId).toList()).stream()
            .collect(Collectors.toMap(TransactionRecordEntity::id, Function.identity()));
        Map<UUID, List<CitedStatute>> citations = citationRepository
            .findRows(judgments.stream().map(JudgmentEntity::id).toList()).stream()
            .collect(Collectors.groupingBy(CitationRow::judgmentId,
                Collectors.mapping(CitationRow::toCited, Collectors.toList())));
        return judgments.stream()
            .map(judgment -> judgment.toDomain(
                transactions.get(judgment.transactionId()).toJudged(),
                citations.getOrDefault(judgment.id(), List.of())))
            .toList();
    }
}
