package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.AnswerSource;
import com.ktc4.pusan4.judgment.domain.UserFact;
import com.ktc4.pusan4.shared.UuidGenerator;
import jakarta.persistence.NoResultException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class UserFactPersistenceService {

    private final UserFactRepository userFactRepository;
    private final QuestionQueueRepository questionRepository;
    private final UuidGenerator uuidGenerator;
    private final Clock clock;

    public UserFactPersistenceService(
        UserFactRepository userFactRepository,
        QuestionQueueRepository questionRepository,
        UuidGenerator uuidGenerator,
        Clock clock
    ) {
        this.userFactRepository = userFactRepository;
        this.questionRepository = questionRepository;
        this.uuidGenerator = uuidGenerator;
        this.clock = clock;
    }

    // UserFact 는 batch 범위다. 다른 batch 의 같은 scope 답은 버전도 따로 매기고 읽지도 않는다 (api.md §3.10).
    @Transactional
    public UUID save(UUID userId, UUID batchId, UserFact fact) {
        return save(userId, batchId, fact, AnswerSource.USER);
    }

    @Transactional
    public UUID save(UUID userId, UUID batchId, UserFact fact, AnswerSource source) {
        UUID factId = uuidGenerator.generate();
        userFactRepository.save(new UserFactEntity(
            factId,
            userId,
            batchId,
            fact,
            nextVersion(userId, batchId, fact.scopeKey(), fact.factType()),
            source
        ));
        return factId;
    }

    /**
     * 답을 취소한다. 지난 답은 그대로 두고 취소를 새 version 으로 쌓는다. 이후 판정은 이 답이 없는 것으로 본다
     * (findAllLatest). 돌려주는 id 는 재판정 revision 의 origin 이 된다.
     */
    @Transactional
    public UUID withdraw(UUID userId, UUID batchId, String scopeKey, String factType) {
        UUID factId = uuidGenerator.generate();
        userFactRepository.save(UserFactEntity.withdrawal(
            factId, userId, batchId, scopeKey, factType, nextVersion(userId, batchId, scopeKey, factType)));
        return factId;
    }

    @Transactional(readOnly = true)
    public Optional<UserFact> findLatest(UUID userId, UUID batchId, String scopeKey, String factType) {
        return userFactRepository
            .findFirstByUserIdAndBatchIdAndScopeKeyAndFactTypeOrderByVersionDesc(
                userId, batchId, scopeKey, factType
            )
            .filter(fact -> !fact.withdrawn())
            .map(UserFactEntity::toDomain);
    }

    @Transactional(readOnly = true)
    public List<UserFact> findAllLatest(UUID userId, UUID batchId) {
        return userFactRepository.findAllLatest(userId, batchId).stream()
            .map(UserFactEntity::toDomain)
            .toList();
    }

    /** findAllLatest 와 같은 답을 같은 순서로, 행 id 와 함께 준다. 판정에 쓴 답을 id 로 남길 때 쓴다. */
    @Transactional(readOnly = true)
    public Map<UserFact, UUID> findAllLatestIds(UUID userId, UUID batchId) {
        Map<UserFact, UUID> ids = new LinkedHashMap<>();
        userFactRepository.findAllLatest(userId, batchId).forEach(fact -> ids.put(fact.toDomain(), fact.id()));
        return ids;
    }

    @Transactional
    public UUID answerQuestion(UUID questionId, UUID userId, UserFact answer) {
        QuestionQueueEntity question = questionRepository.findForUser(questionId, userId)
            .orElseThrow(NoResultException::new);
        UUID batchId = questionRepository.findBatchId(questionId);
        UUID factId = uuidGenerator.generate();
        userFactRepository.save(new UserFactEntity(
            factId,
            userId,
            batchId,
            answer,
            nextVersion(userId, batchId, answer.scopeKey(), answer.factType())
        ));
        question.answer(factId, answer, OffsetDateTime.now(clock));
        return factId;
    }

    // 락 획득 순서 불변식: user(app_user) → transaction. 두 락을 모두 잡는 경로는
    // 반드시 user 락을 먼저 잡는다(데드락 방지). 특히 answerQuestion 이 여기서 user 락을
    // 잡은 뒤 재판정으로 이어지면 JudgmentService.nextRevision 이 transaction 락을 잡으므로,
    // 그 반대 순서(transaction → user)로 잡는 경로를 새로 만들지 말 것.
    private int nextVersion(UUID userId, UUID batchId, String scopeKey, String factType) {
        userFactRepository.lockUser(userId).orElseThrow(NoResultException::new);
        return userFactRepository.findNextVersion(userId, batchId, scopeKey, factType);
    }
}
