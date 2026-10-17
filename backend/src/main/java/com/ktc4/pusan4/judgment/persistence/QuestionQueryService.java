package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.Question;
import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.judgment.persistence.JudgmentRepository.AutomaticVerdict;
import com.ktc4.pusan4.judgment.persistence.QuestionQueueRepository.QuestionRow;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
     * status 거르기·묶기·페이지는 미해소 집계가 그 앞의 목록을 써야 해서 부르는 쪽이 한다.
     */
    @Transactional(readOnly = true)
    public List<Question> find(UUID userId, UUID batchId, UUID transactionId) {
        List<QuestionRow> rows = questionRepository.findRows(userId, batchId, transactionId);
        Set<UUID> transactionIds = rows.stream().map(QuestionRow::transactionId).collect(Collectors.toSet());

        Map<UUID, TransactionRecordEntity> transactions = transactionRepository.findByIdIn(transactionIds).stream()
            .collect(Collectors.toMap(TransactionRecordEntity::id, Function.identity()));
        Map<UUID, String> answers = factRepository.findByIdIn(rows.stream()
                .map(row -> row.question().answeredFactId())
                .filter(Objects::nonNull)
                .toList()).stream()
            .collect(Collectors.toMap(UserFactEntity::id, fact -> fact.toDomain().selectedValue()));
        Set<UUID> overridden = new HashSet<>(overrideRepository.findActiveTransactionIds(transactionIds));
        Set<UUID> awaitingExplanation = awaitingExplanation(rows, transactionIds);

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
    private Set<UUID> awaitingExplanation(List<QuestionRow> rows, Set<UUID> transactionIds) {
        Set<UUID> withPending = rows.stream()
            .filter(row -> row.question().isPending())
            .map(QuestionRow::transactionId)
            .collect(Collectors.toSet());
        return judgmentRepository.findLatestAutomaticVerdicts(transactionIds).stream()
            .filter(verdict -> Verdict.UNAVAILABLE.name().equals(verdict.verdict()))
            .map(AutomaticVerdict::transactionId)
            .filter(withPending::contains)
            .collect(Collectors.toSet());
    }
}
