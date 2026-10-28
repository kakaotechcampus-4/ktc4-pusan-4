package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentOrigin;
import com.ktc4.pusan4.judgment.domain.JudgmentOriginType;
import com.ktc4.pusan4.judgment.domain.PendingTotal;
import com.ktc4.pusan4.judgment.domain.Question;
import com.ktc4.pusan4.judgment.domain.QuestionGroup;
import com.ktc4.pusan4.judgment.domain.QuestionStatus;
import com.ktc4.pusan4.judgment.domain.UserFact;
import com.ktc4.pusan4.judgment.persistence.QuestionQueueRepository.AnswerTarget;
import com.ktc4.pusan4.shared.api.ApiException;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.UUID;

/**
 * 확인 질문 응답과 부분 재판정 (api.md 3.10), 일괄 응답 (api.md 3.11). 새 JudgmentRun 은 만들지 않는다.
 */
@Service
public class QuestionAnswerService {

    private static final String MERCHANT_SCOPE = "merchant:";

    private final QuestionQueueRepository questionRepository;
    private final TransactionRecordRepository transactionRepository;
    private final UploadBatchRepository batchRepository;
    private final UserFactPersistenceService userFactService;
    private final QuestionQueryService queryService;
    private final JudgmentExecutor executor;
    private final Clock clock;
    private final EntityManager entityManager;

    public QuestionAnswerService(
        QuestionQueueRepository questionRepository,
        TransactionRecordRepository transactionRepository,
        UploadBatchRepository batchRepository,
        UserFactPersistenceService userFactService,
        QuestionQueryService queryService,
        JudgmentExecutor executor,
        Clock clock,
        EntityManager entityManager
    ) {
        this.questionRepository = questionRepository;
        this.transactionRepository = transactionRepository;
        this.batchRepository = batchRepository;
        this.userFactService = userFactService;
        this.queryService = queryService;
        this.executor = executor;
        this.clock = clock;
        this.entityManager = entityManager;
    }

    /**
     * 1. 검증 → 2~3. 답 기록(record) → 4~8. 재판정(rejudge). 한 거래라도 재판정에 실패하면 전체가 롤백된다.
     */
    @Transactional
    public QuestionAnswerResult answer(UUID userId, List<UUID> questionIds, String value) {
        List<AnswerTarget> requested = findRequested(userId, questionIds);
        validateAnswerable(requested, value);
        AnswerTarget first = requested.getFirst();
        Answered answered = record(userId, first.batchId(), first.question().groupKey(),
            first.question().factType(), value);
        int rejudged = rejudge(userId, List.of(answered));
        return new QuestionAnswerResult(answered.questionCount(), answered.factId(), rejudged);
    }

    /**
     * Batch 의 PENDING 질문 중 factType 이 같은 그룹을 한 번에 답한다. 그룹(groupKey)마다 UserFact 를 하나 만들고,
     * 모든 답을 기록한 뒤 영향받는 거래를 한 번씩만 재판정한다. 그룹마다 재판정하면 앞 그룹의 재판정이
     * 같은 거래의 다른 질문을 취소해 뒤 그룹의 답을 기록할 수 없다.
     * 소명 대기 거래의 질문이 섞인 그룹은 통째로 뺀다(QuestionGroup.bulkAnswerable). 가맹점 단위 UserFact 가
     * 같은 가맹점의 소명 대기 거래를 소명 없이 풀지 않게 하려는 것이다.
     */
    @Transactional
    public BulkAnswerResult bulkAnswer(UUID userId, UUID batchId, String factType, String value) {
        if (!batchRepository.existsByIdAndUserId(batchId, userId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "BATCH_NOT_FOUND", "업로드를 찾을 수 없습니다.");
        }
        List<Question> questions = queryService.find(userId, batchId, null);
        // 이력(상태 무관)에 없는 factType 만 에러다. 이력이 있는데 대상이 0건이면 answeredCount = 0 (api.md 3.11)
        if (questions.stream().noneMatch(question -> question.factType().equals(factType))) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "UNKNOWN_FACT_TYPE", "알 수 없는 질문 종류입니다.");
        }
        List<QuestionGroup> pending = QuestionGroup.group(questions.stream()
            .filter(question -> question.status() == QuestionStatus.PENDING)
            .toList());
        List<QuestionGroup> sameType = pending.stream()
            .filter(group -> group.factType().equals(factType))
            .toList();
        List<QuestionGroup> targets = sameType.stream().filter(QuestionGroup::bulkAnswerable).toList();
        if (targets.stream().flatMap(group -> group.questions().stream())
            .anyMatch(question -> !question.options().isEmpty() && !question.options().contains(value))) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_ANSWER_VALUE",
                "모든 대상 질문이 허용하는 값이 아닙니다.");
        }

        List<Answered> answered = targets.stream()
            .map(group -> record(userId, batchId, group.groupKey(), factType, value))
            .toList();
        int rejudged = rejudge(userId, answered);
        // 재판정은 다른 revision 의 대기 질문을 bulk update 로 취소한다(DB 에만 반영). 앞에서 읽은 질문 엔티티가
        // PENDING 으로 남아 있으면 미해소 집계에 섞이므로, 반영한 뒤 비우고 다시 읽는다.
        entityManager.flush();
        entityManager.clear();
        return new BulkAnswerResult(
            answered.stream().mapToInt(Answered::questionCount).sum(),
            questionCount(pending) - questionCount(sameType),
            questionCount(sameType) - questionCount(targets),
            answered.stream().map(Answered::factId).toList(),
            rejudged,
            PendingTotal.of(queryService.find(userId, batchId, null))
        );
    }

    /**
     * 2. UserFact 새 version → 3. 같은 Batch·groupKey·factType 질문을 모두 이 답으로. 재판정할 거래를 모아 돌려준다.
     */
    private Answered record(UUID userId, UUID batchId, String groupKey, String factType, String value) {
        // 사용자 락을 잡는다. 재판정이 잡는 거래 락보다 먼저여야 한다(UserFactPersistenceService.nextVersion).
        UUID factId = userFactService.save(userId, batchId, new UserFact(groupKey, factType, Map.of("value", value)));

        List<AnswerTarget> siblings = questionRepository.findSiblings(batchId, groupKey, factType);
        OffsetDateTime now = OffsetDateTime.now(clock);
        siblings.forEach(sibling -> sibling.question().recordAnswer(factId, now));

        Set<UUID> targets = new HashSet<>();
        siblings.forEach(sibling -> targets.add(sibling.transactionId()));
        if (groupKey.startsWith(MERCHANT_SCOPE)) {
            targets.addAll(transactionRepository.findJudgedTargetIdsByMerchant(
                batchId, groupKey.substring(MERCHANT_SCOPE.length())));
        }
        // 질문이 생긴 판정의 Context 로 재판정한다. 그룹 안에서 버전이 갈리면 가장 최근 것을 쓴다.
        int contextVersion = siblings.stream().mapToInt(AnswerTarget::contextVersion).max().orElseThrow();
        return new Answered(factId, siblings.size(), targets, contextVersion);
    }

    /**
     * 4~6. 재판정. 거래는 한 번씩만, 먼저 기록한 UserFact 를 origin 으로 판정한다. 일괄 응답에서 그룹 간 Context 버전이
     * 갈리면 가장 최근 것을 쓴다. 동시에 들어온 응답끼리 거래 락을 같은 순서로 잡도록 id 순으로 재판정한다.
     * 더 필요 없는 질문 취소(7)와 새 질문(8)은 재판정(JudgmentExecutor)이 한다.
     */
    private int rejudge(UUID userId, List<Answered> answered) {
        if (answered.isEmpty()) {
            return 0;
        }
        SortedMap<UUID, JudgmentOrigin> origins = new TreeMap<>();
        answered.forEach(each -> each.transactionIds().forEach(transactionId ->
            origins.putIfAbsent(transactionId, new JudgmentOrigin(JudgmentOriginType.USER_FACT, each.factId()))));
        int contextVersion = answered.stream().mapToInt(Answered::contextVersion).max().orElseThrow();
        executor.rejudge(userId, origins, contextVersion);
        return origins.size();
    }

    private static int questionCount(List<QuestionGroup> groups) {
        return groups.stream().mapToInt(QuestionGroup::count).sum();
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

    private record Answered(UUID factId, int questionCount, Set<UUID> transactionIds, int contextVersion) {
    }
}
