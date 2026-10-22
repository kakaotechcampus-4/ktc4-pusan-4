package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentOrigin;
import com.ktc4.pusan4.judgment.domain.JudgmentOriginType;
import com.ktc4.pusan4.judgment.domain.UserFact;
import com.ktc4.pusan4.judgment.persistence.QuestionQueueRepository.AnswerTarget;
import com.ktc4.pusan4.shared.api.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

/**
 * 확인 질문 응답과 부분 재판정 (api.md 3.10). 새 JudgmentRun 은 만들지 않는다.
 */
@Service
public class QuestionAnswerService {

    private static final String MERCHANT_SCOPE = "merchant:";

    private final QuestionQueueRepository questionRepository;
    private final TransactionRecordRepository transactionRepository;
    private final UserFactPersistenceService userFactService;
    private final JudgmentExecutor executor;
    private final Clock clock;

    public QuestionAnswerService(
        QuestionQueueRepository questionRepository,
        TransactionRecordRepository transactionRepository,
        UserFactPersistenceService userFactService,
        JudgmentExecutor executor,
        Clock clock
    ) {
        this.questionRepository = questionRepository;
        this.transactionRepository = transactionRepository;
        this.userFactService = userFactService;
        this.executor = executor;
        this.clock = clock;
    }

    /**
     * 1. 검증 → 2. UserFact 새 version → 3. 같은 Batch·groupKey·factType 질문을 모두 이 답으로 → 4~6. 재판정.
     * 더 필요 없는 질문 취소(7)와 새 질문(8)은 재판정(JudgmentExecutor)이 한다.
     * 한 거래라도 재판정에 실패하면 전체가 롤백된다.
     */
    @Transactional
    public QuestionAnswerResult answer(UUID userId, List<UUID> questionIds, String value) {
        List<AnswerTarget> requested = findRequested(userId, questionIds);
        validateAnswerable(requested, value);
        AnswerTarget first = requested.getFirst();
        String groupKey = first.question().groupKey();
        String factType = first.question().factType();

        // 사용자 락을 잡는다. 아래 재판정이 잡는 거래 락보다 먼저여야 한다(UserFactPersistenceService.nextVersion).
        UUID factId = userFactService.save(userId, first.batchId(),
            new UserFact(groupKey, factType, Map.of("value", value)));

        List<AnswerTarget> siblings = questionRepository.findSiblings(first.batchId(), groupKey, factType);
        OffsetDateTime now = OffsetDateTime.now(clock);
        siblings.forEach(sibling -> sibling.question().recordAnswer(factId, now));

        // 동시에 들어온 응답끼리 거래 락을 같은 순서로 잡도록 id 순으로 재판정한다.
        Set<UUID> targets = new TreeSet<>();
        siblings.forEach(sibling -> targets.add(sibling.transactionId()));
        if (groupKey.startsWith(MERCHANT_SCOPE)) {
            targets.addAll(transactionRepository.findJudgedTargetIdsByMerchant(
                first.batchId(), groupKey.substring(MERCHANT_SCOPE.length())));
        }
        // 질문이 생긴 판정의 Context 로 재판정한다. 그룹 안에서 버전이 갈리면 가장 최근 것을 쓴다.
        int contextVersion = siblings.stream().mapToInt(AnswerTarget::contextVersion).max().orElseThrow();
        executor.rejudge(userId, List.copyOf(targets), new JudgmentOrigin(JudgmentOriginType.USER_FACT, factId),
            contextVersion);
        return new QuestionAnswerResult(siblings.size(), factId, targets.size());
    }

    private List<AnswerTarget> findRequested(UUID userId, List<UUID> questionIds) {
        List<AnswerTarget> requested = questionRepository.findAnswerTargets(questionIds, userId);
        if (requested.size() != new HashSet<>(questionIds).size()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "QUESTION_NOT_FOUND", "질문을 찾을 수 없습니다.");
        }
        return requested;
    }

    /** 요청한 질문이 한 그룹(같은 Batch·groupKey·factType)이고, 답할 수 있고, 값을 받는지 본다. */
    private static void validateAnswerable(List<AnswerTarget> requested, String value) {
        AnswerTarget first = requested.getFirst();
        if (requested.stream().anyMatch(target -> !target.batchId().equals(first.batchId()))) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "QUESTIONS_FROM_DIFFERENT_BATCHES",
                "서로 다른 업로드의 질문을 함께 답할 수 없습니다.");
        }
        if (requested.stream().anyMatch(target ->
            !target.question().groupKey().equals(first.question().groupKey())
                || !target.question().factType().equals(first.question().factType()))) {
            throw new ApiException(HttpStatus.CONFLICT, "QUESTION_GROUP_MISMATCH", "서로 다른 질문을 함께 답할 수 없습니다.");
        }
        if (requested.stream().anyMatch(target -> target.question().isCanceled())) {
            throw new ApiException(HttpStatus.CONFLICT, "QUESTION_NOT_ANSWERABLE", "취소된 질문에는 답할 수 없습니다.");
        }
        if (requested.stream().anyMatch(target -> !target.question().accepts(value))) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_ANSWER_VALUE", "선택지에 없는 값입니다.");
        }
    }
}
