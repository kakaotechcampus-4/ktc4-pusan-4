package com.ktc4.pusan4.progress.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentRunStatus;
import com.ktc4.pusan4.judgment.domain.PendingTotal;
import com.ktc4.pusan4.judgment.domain.PreviousAnswerSuggestion;
import com.ktc4.pusan4.judgment.persistence.QuestionQueryService;
import com.ktc4.pusan4.judgment.persistence.QuestionSuggestionService;
import com.ktc4.pusan4.progress.domain.NextStep;
import com.ktc4.pusan4.progress.persistence.ProgressRepository.BatchRow;
import com.ktc4.pusan4.progress.persistence.ProgressRepository.Pending;
import com.ktc4.pusan4.progress.persistence.ProgressRepository.RunRow;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.user.domain.BusinessContext;
import com.ktc4.pusan4.user.persistence.BusinessContextService;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/**
 * 업로드 하나의 진행 상황 (api.md 3.14). 비서와 화면 속 도움이 다음 할 일을 안내하는 데 쓴다.
 */
@Service
public class ProgressService {

    private final ProgressRepository progressRepository;
    private final BusinessContextService contextService;
    private final QuestionQueryService questionQueryService;
    private final QuestionSuggestionService suggestionService;

    public ProgressService(
        ProgressRepository progressRepository,
        BusinessContextService contextService,
        QuestionQueryService questionQueryService,
        QuestionSuggestionService suggestionService
    ) {
        this.progressRepository = progressRepository;
        this.contextService = contextService;
        this.questionQueryService = questionQueryService;
        this.suggestionService = suggestionService;
    }

    @Transactional(readOnly = true)
    public Progress progress(UUID userId, UUID batchId) {
        BatchRow batch = progressRepository.findBatch(batchId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "BATCH_NOT_FOUND", "업로드를 찾을 수 없습니다."));
        Optional<BusinessContext> context = contextService.findCurrent(userId);
        Pending classification = progressRepository.countPendingClassification(batchId);
        RunRow run = progressRepository.findLatestRuns(batchId, PageRequest.of(0, 1)).stream().findFirst().orElse(null);
        PendingTotal questions = PendingTotal.of(questionQueryService.find(userId, batchId, null));
        int fillable = suggestionService.suggest(userId, batchId).stream()
            .filter(PreviousAnswerSuggestion::fillable)
            .mapToInt(PreviousAnswerSuggestion::questionCount)
            .sum();
        NextStep next = NextStep.of(classification.count() > 0, context.isPresent(),
            run == null ? null : run.status(), questions.count() > 0);
        return new Progress(
            new Batch(batch.id(), batch.cardIssuer(), batch.periodStart(), batch.periodEnd(), batch.transactionCount()),
            context.orElse(null), new PendingTotal((int) classification.count(), classification.amount()),
            run == null ? null : new Run(run.id(), run.status()), questions, fillable, next);
    }

    /** 수입금액·이름·이메일은 담지 않는다(agent-secretary.md QR-7). 응답이 문진에서 버전·기장의무·직원 유무만 꺼낸다. */
    public record Progress(
        Batch batch,
        BusinessContext context,
        PendingTotal classification,
        Run run,
        PendingTotal questions,
        int fillableFromPrevious,
        NextStep next
    ) {
    }

    public record Batch(UUID id, String cardIssuer, LocalDate periodStart, LocalDate periodEnd, long transactionCount) {
    }

    public record Run(UUID id, JudgmentRunStatus status) {
    }
}
