package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.PendingTotal;
import com.ktc4.pusan4.judgment.domain.Question;
import com.ktc4.pusan4.judgment.domain.QuestionGroup;
import com.ktc4.pusan4.judgment.domain.QuestionStatus;
import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.judgment.persistence.JudgmentRepository.AutomaticVerdict;
import com.ktc4.pusan4.judgment.persistence.QuestionQueueRepository.QuestionRow;
import com.ktc4.pusan4.judgment.persistence.QuestionQueueRepositoryCustom.PendingCount;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 확인 질문 조회 (api.md 3.9).
 */
@Service
public class QuestionQueryService {

    private final QuestionQueueRepository questionRepository;
    private final TransactionRecordRepository transactionRepository;
    private final UserFactRepository factRepository;
    private final JudgmentOverrideRepository overrideRepository;
    private final JudgmentRepository judgmentRepository;

    public QuestionQueryService(
        QuestionQueueRepository questionRepository,
        TransactionRecordRepository transactionRepository,
        UserFactRepository factRepository,
        JudgmentOverrideRepository overrideRepository,
        JudgmentRepository judgmentRepository
    ) {
        this.questionRepository = questionRepository;
        this.transactionRepository = transactionRepository;
        this.factRepository = factRepository;
        this.overrideRepository = overrideRepository;
        this.judgmentRepository = judgmentRepository;
    }

    /**
     * 지금 판정 대상인 본인 거래에 걸린 질문을 상태와 상관없이 모두 돌려준다. 정렬: createdAt ASC, id ASC.
     * 묶기(grouped)와 내보내기처럼 전부가 필요한 곳이 쓴다. 목록 한 쪽은 {@link #page} 를 쓴다.
     */
    @Transactional(readOnly = true)
    public List<Question> find(UUID userId, UUID batchId, UUID transactionId) {
        List<QuestionRow> rows = questionRepository.findRows(userId, batchId, transactionId);
        Set<UUID> withPending = rows.stream()
            .filter(row -> row.question().isPending())
            .map(QuestionRow::transactionId)
            .collect(Collectors.toSet());
        return toDomain(rows, withPending);
    }

    /**
     * {@link #find} 와 같은 조건에 status 를 더한 한 쪽. 그 쪽의 질문만 거래, 답, 수정 여부를 붙인다.
     * 전부 읽어 메모리에서 자르면 끝까지 읽는 화면이 쪽 수만큼 전체를 다시 읽는다.
     */
    @Transactional(readOnly = true)
    public Page<Question> page(UUID userId, UUID batchId, UUID transactionId, QuestionStatus status, int page, int size) {
        Page<QuestionRow> rows = questionRepository.findRowsPage(userId, batchId, transactionId,
            status == null ? null : status.name(), PageRequest.of(page, size));
        Set<UUID> withPending = pendingTransactionIds(rows.stream().map(QuestionRow::transactionId).toList());
        return new PageImpl<>(toDomain(rows.getContent(), withPending), rows.getPageable(), rows.getTotalElements());
    }

    /**
     * 묶음 목록(grouped=true)의 한 쪽. 그룹 순서는 질문 전부로 정해지므로 묶기와 순서에 쓰는 값만 전부 읽고,
     * 고른 쪽의 그룹에 든 질문에만 거래, 답, 수정 여부를 붙인다.
     */
    @Transactional(readOnly = true)
    public Page<QuestionGroup> groupPage(
        UUID userId, UUID batchId, UUID transactionId, QuestionStatus status, int page, int size
    ) {
        List<List<QuestionGroup.Member>> ordered = QuestionGroup.order(questionRepository
            .findMembers(userId, batchId, transactionId, status == null ? null : status.name()).stream()
            .map(row -> new QuestionGroup.Member(row.id(), row.batchId(), row.groupKey(), row.factType(),
                QuestionStatus.valueOf(row.status()), row.transactionId(), row.approvedAt(), row.amount()))
            .toList());
        int from = (int) Math.min((long) page * size, ordered.size());
        List<UUID> questionIds = ordered.subList(from, Math.min(from + size, ordered.size())).stream()
            .flatMap(List::stream)
            .map(QuestionGroup.Member::id)
            .toList();
        List<QuestionRow> rows = questionRepository.findRowsByIds(questionIds);
        Set<UUID> withPending = pendingTransactionIds(rows.stream().map(QuestionRow::transactionId).toList());
        return new PageImpl<>(QuestionGroup.group(toDomain(rows, withPending)), PageRequest.of(page, size),
            ordered.size());
    }

    /** 미해소 집계 (api.md 3.9). {@link #find} 와 같은 조건의 PENDING 질문 수와 그 거래들의 결제 금액 합이다. */
    @Transactional(readOnly = true)
    public PendingTotal unresolved(UUID userId, UUID batchId, UUID transactionId) {
        PendingCount pending = questionRepository.countPending(userId, batchId, transactionId);
        return new PendingTotal(Math.toIntExact(pending.count()), pending.amount() == null ? 0L : pending.amount());
    }

    /** 주어진 거래 가운데 답하지 않은 질문이 남은 거래. */
    @Transactional(readOnly = true)
    public Set<UUID> pendingTransactionIds(Collection<UUID> transactionIds) {
        return new HashSet<>(questionRepository.findPendingTransactionIds(Set.copyOf(transactionIds)));
    }

    /** withPending 은 답하지 않은 질문이 남은 거래다. 소명 대기를 가르는 데 쓴다. */
    private List<Question> toDomain(List<QuestionRow> rows, Set<UUID> withPending) {
        Set<UUID> transactionIds = rows.stream().map(QuestionRow::transactionId).collect(Collectors.toSet());
        Map<UUID, TransactionRecordEntity> transactions = transactionRepository.findByIdIn(transactionIds).stream()
            .collect(Collectors.toMap(TransactionRecordEntity::id, Function.identity()));
        Map<UUID, String> answers = factRepository.findByIdIn(rows.stream()
                .map(row -> row.question().answeredFactId())
                .filter(Objects::nonNull)
                .toList()).stream()
            .collect(Collectors.toMap(UserFactEntity::id, fact -> fact.toDomain().selectedValue()));
        Set<UUID> overridden = new HashSet<>(overrideRepository.findActiveTransactionIds(transactionIds));
        Set<UUID> awaitingExplanation = awaitingExplanation(transactionIds, withPending);

        return rows.stream()
            .map(row -> row.question().toDomain(row.batchId(), row.transactionId(),
                answers.get(row.question().answeredFactId()),
                transactions.get(row.transactionId()).toJudged(),
                overridden.contains(row.transactionId()),
                awaitingExplanation.contains(row.transactionId())))
            .toList();
    }

    /**
     * 소명 대기 거래 (api.md 3.11): override 를 뺀 최신 자동 판정이 UNAVAILABLE 인데 PENDING 질문이 남은 거래.
     * 현재 결과가 아니라 자동 판정을 보는 것은 override 를 해제하면 자동 판정이 다시 현재 결과가 되기 때문이다.
     */
    private Set<UUID> awaitingExplanation(Set<UUID> transactionIds, Set<UUID> withPending) {
        return judgmentRepository.findLatestAutomaticVerdicts(transactionIds).stream()
            .filter(verdict -> Verdict.UNAVAILABLE.name().equals(verdict.verdict()))
            .map(AutomaticVerdict::transactionId)
            .filter(withPending::contains)
            .collect(Collectors.toSet());
    }
}
