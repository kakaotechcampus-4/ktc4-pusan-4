package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.UserFact;
import com.ktc4.pusan4.shared.UuidGenerator;
import jakarta.persistence.NoResultException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
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

    @Transactional
    public UUID save(UUID userId, UserFact fact) {
        UUID factId = uuidGenerator.generate();
        userFactRepository.save(new UserFactEntity(
            factId,
            userId,
            fact,
            nextVersion(userId, fact.scopeKey(), fact.factType())
        ));
        return factId;
    }

    @Transactional(readOnly = true)
    public Optional<UserFact> findLatest(UUID userId, String scopeKey, String factType) {
        return userFactRepository
            .findFirstByUserIdAndScopeKeyAndFactTypeOrderByVersionDesc(userId, scopeKey, factType)
            .map(UserFactEntity::toDomain);
    }

    @Transactional(readOnly = true)
    public List<UserFact> findAllLatest(UUID userId) {
        return userFactRepository.findAllLatest(userId).stream()
            .map(UserFactEntity::toDomain)
            .toList();
    }

    @Transactional
    public UUID answerQuestion(UUID questionId, UUID userId, UserFact answer) {
        QuestionQueueEntity question = questionRepository.findForUser(questionId, userId)
            .orElseThrow(NoResultException::new);
        UUID factId = uuidGenerator.generate();
        userFactRepository.save(new UserFactEntity(
            factId,
            userId,
            answer,
            nextVersion(userId, answer.scopeKey(), answer.factType())
        ));
        question.answer(factId, answer, OffsetDateTime.now(clock));
        return factId;
    }

    private int nextVersion(UUID userId, String scopeKey, String factType) {
        userFactRepository.lockUser(userId).orElseThrow(NoResultException::new);
        return userFactRepository.findNextVersion(userId, scopeKey, factType);
    }
}
