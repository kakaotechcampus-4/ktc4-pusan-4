package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.shared.UuidGenerator;
import com.ktc4.pusan4.shared.api.ApiException;
import jakarta.persistence.NoResultException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 사용자 판정 수정과 해제 (api.md 3.8). 에러는 #62 논의 중 FE 목업이 따르는 쪽으로 정했다.
 */
@Service
public class JudgmentOverrideService {

    private final JudgmentRepository judgmentRepository;
    private final JudgmentOverrideRepository overrideRepository;
    private final JudgmentCitationRepository citationRepository;
    private final TransactionRecordRepository transactionRepository;
    private final UuidGenerator uuidGenerator;
    private final Clock clock;

    public JudgmentOverrideService(
        JudgmentRepository judgmentRepository,
        JudgmentOverrideRepository overrideRepository,
        JudgmentCitationRepository citationRepository,
        TransactionRecordRepository transactionRepository,
        UuidGenerator uuidGenerator,
        Clock clock
    ) {
        this.judgmentRepository = judgmentRepository;
        this.overrideRepository = overrideRepository;
        this.citationRepository = citationRepository;
        this.transactionRepository = transactionRepository;
        this.uuidGenerator = uuidGenerator;
        this.clock = clock;
    }

    /**
     * 판정을 그대로 두고 verdict 만 바꾼 새 revision 을 만든다. 같은 거래의 이전 활성 수정은 해제된다.
     *
     * @return 새 revision 의 판정 id
     */
    @Transactional
    public UUID override(UUID userId, UUID judgmentId, Verdict toVerdict, String reason) {
        JudgmentEntity source = judgmentRepository.findForUser(judgmentId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "JUDGMENT_NOT_FOUND", "판정을 찾을 수 없습니다."));
        // 확인 필요로 바꾸면 답할 질문이 없는 확인 필요가 된다 (#62).
        if (toVerdict == Verdict.NEEDS_REVIEW) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "UNPROCESSABLE_ENTITY", "확인 필요로는 바꿀 수 없습니다.");
        }
        // 재판정(JudgmentService.nextRevision)과 같은 거래 락이다. 그사이 현재 판정이 바뀌지 않게 먼저 잡는다.
        TransactionRecordEntity transaction = transactionRepository.findByIdForUpdate(source.transactionId())
            .orElseThrow(NoResultException::new);
        if (!transaction.judgeable() || !judgmentId.equals(currentJudgmentId(userId, transaction.id()))) {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "지금 판정이 아니어서 바꿀 수 없습니다.");
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        overrideRepository.releaseActive(transaction.id(), now);
        UUID overrideId = uuidGenerator.generate();
        overrideRepository.save(new JudgmentOverrideEntity(
            overrideId, transaction.id(), judgmentId, toVerdict, reason, now));

        UUID revisionId = uuidGenerator.generate();
        judgmentRepository.save(source.overriddenAs(
            revisionId, judgmentRepository.findNextRevision(transaction.id()), toVerdict, overrideId));
        citationRepository.findRows(List.of(judgmentId)).forEach(citation ->
            citationRepository.save(new JudgmentCitationEntity(revisionId, citation.statuteVersionId())));
        return revisionId;
    }

    /** 이미 해제한 수정도 그대로 성공이다. 수정 revision 은 지우지 않는다. */
    @Transactional
    public void release(UUID userId, UUID overrideId) {
        overrideRepository.findForUser(overrideId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "JUDGMENT_OVERRIDE_NOT_FOUND",
                "사용자 수정을 찾을 수 없습니다."))
            .release(OffsetDateTime.now(clock));
    }

    /** 현재 판정(api.md §5). 판정 목록의 "현재 판정" 조건을 그대로 쓴다. */
    private UUID currentJudgmentId(UUID userId, UUID transactionId) {
        return judgmentRepository.findPage(userId, transactionId, null, null, null, null, null, false,
                PageRequest.of(0, 1))
            .stream()
            .map(JudgmentEntity::id)
            .findFirst()
            .orElse(null);
    }
}
