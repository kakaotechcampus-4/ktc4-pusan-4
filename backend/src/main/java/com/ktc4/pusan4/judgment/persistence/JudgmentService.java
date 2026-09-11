package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.Citation;
import com.ktc4.pusan4.judgment.domain.Judgment;
import com.ktc4.pusan4.shared.UuidGenerator;
import jakarta.persistence.NoResultException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class JudgmentService {

    private final JudgmentRepository judgmentRepository;
    private final TransactionRecordRepository transactionRepository;
    private final StatuteVersionRepository statuteVersionRepository;
    private final JudgmentCitationRepository citationRepository;
    private final QuestionQueueRepository questionRepository;
    private final UnmatchedLogRepository unmatchedLogRepository;
    private final UuidGenerator uuidGenerator;

    public JudgmentService(
        JudgmentRepository judgmentRepository,
        TransactionRecordRepository transactionRepository,
        StatuteVersionRepository statuteVersionRepository,
        JudgmentCitationRepository citationRepository,
        QuestionQueueRepository questionRepository,
        UnmatchedLogRepository unmatchedLogRepository,
        UuidGenerator uuidGenerator
    ) {
        this.judgmentRepository = judgmentRepository;
        this.transactionRepository = transactionRepository;
        this.statuteVersionRepository = statuteVersionRepository;
        this.citationRepository = citationRepository;
        this.questionRepository = questionRepository;
        this.unmatchedLogRepository = unmatchedLogRepository;
        this.uuidGenerator = uuidGenerator;
    }

    @Transactional
    public UUID save(SaveJudgmentCommand command) {
        Judgment judgment = command.judgment();
        UUID judgmentId = uuidGenerator.generate();
        judgmentRepository.save(new JudgmentEntity(
            judgmentId,
            command,
            nextRevision(command.transactionId())
        ));

        saveCitations(judgmentId, judgment.citations(), command.statuteEffectiveDate());
        judgment.questions().forEach(question ->
            questionRepository.save(new QuestionQueueEntity(
                uuidGenerator.generate(), judgmentId, question
            ))
        );
        if (judgment.unmatchedReason() != null) {
            requireUnmatchedContext(command);
            unmatchedLogRepository.save(new UnmatchedLogEntity(judgmentId, command));
        }
        return judgmentId;
    }

    // 락 획득 순서 불변식: user(app_user) → transaction. 여기서 잡는 transaction 락은
    // 항상 user 락(UserFactPersistenceService.nextVersion) 다음에만 잡는다(데드락 방지).
    private int nextRevision(UUID transactionId) {
        transactionRepository.findByIdForUpdate(transactionId)
            .orElseThrow(NoResultException::new);
        return judgmentRepository.findNextRevision(transactionId);
    }

    private void saveCitations(UUID judgmentId, List<Citation> citations, LocalDate effectiveDate) {
        for (Citation citation : citations) {
            List<Long> versionIds = statuteVersionRepository.findEffectiveVersionIds(
                citation.statuteId(), effectiveDate
            );
            if (versionIds.size() != 1) {
                throw new IllegalStateException(
                    "Expected one effective statute version for " + citation.statuteId()
                );
            }
            citationRepository.save(new JudgmentCitationEntity(judgmentId, versionIds.getFirst()));
        }
    }

    private static void requireUnmatchedContext(SaveJudgmentCommand command) {
        Objects.requireNonNull(command.merchantCategory(), "merchantCategory is required for unmatched log");
        Objects.requireNonNull(command.merchantRaw(), "merchantRaw is required for unmatched log");
        Objects.requireNonNull(command.industryCode(), "industryCode is required for unmatched log");
    }
}
