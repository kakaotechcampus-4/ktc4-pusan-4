package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.PastAnswer;
import com.ktc4.pusan4.judgment.domain.PreviousAnswer;
import com.ktc4.pusan4.judgment.domain.PreviousAnswerSuggester;
import com.ktc4.pusan4.judgment.domain.PreviousAnswerSuggestion;
import com.ktc4.pusan4.judgment.domain.QuestionGroup;
import com.ktc4.pusan4.judgment.domain.QuestionStatus;
import com.ktc4.pusan4.judgment.domain.RuleSet;
import com.ktc4.pusan4.shared.api.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 지난번 답 불러오기 (api.md 3.14, agent-secretary.md 3.1). 다른 업로드의 답은 읽기만 한다.
 */
@Service
public class QuestionSuggestionService {

    private final UploadBatchRepository batchRepository;
    private final QuestionQueryService queryService;
    private final QuestionQueueRepository questionRepository;
    private final RuleSet ruleSet;

    public QuestionSuggestionService(
        UploadBatchRepository batchRepository,
        QuestionQueryService queryService,
        QuestionQueueRepository questionRepository,
        RuleSet ruleSet
    ) {
        this.batchRepository = batchRepository;
        this.queryService = queryService;
        this.questionRepository = questionRepository;
        this.ruleSet = ruleSet;
    }

    /** 이 batch 의 PENDING 질문 그룹마다 하나. 남의 batch 는 없는 batch 와 같다. */
    @Transactional(readOnly = true)
    public List<PreviousAnswerSuggestion> suggest(UUID userId, UUID batchId) {
        if (!batchRepository.existsByIdAndUserId(batchId, userId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "BATCH_NOT_FOUND", "업로드를 찾을 수 없습니다.");
        }
        List<QuestionGroup> pending = QuestionGroup.group(queryService.find(userId, batchId, null).stream()
            .filter(question -> question.status() == QuestionStatus.PENDING)
            .toList());
        // C 등급 질문은 지난 답을 읽을 필요가 없다.
        Set<String> codes = pending.stream()
            .map(group -> group.questions().getFirst().code())
            .filter(code -> ruleSet.previousAnswer(code) != PreviousAnswer.NONE)
            .collect(Collectors.toSet());
        List<PastAnswer> past = codes.isEmpty() ? List.of() : questionRepository
            .findPastAnswers(userId, batchId, codes).stream()
            .map(row -> new PastAnswer(row.code(), row.groupKey(), row.merchantNorm(),
                row.fact().toDomain().selectedValue(), row.fact().source(), row.batchId(), row.periodStart(),
                row.periodEnd(), row.cardIssuer(), row.fact().version()))
            .toList();
        return PreviousAnswerSuggester.suggest(pending, ruleSet::previousAnswer, past);
    }
}
