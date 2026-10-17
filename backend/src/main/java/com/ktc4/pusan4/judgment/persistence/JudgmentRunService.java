package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentOrigin;
import com.ktc4.pusan4.judgment.domain.JudgmentOriginType;
import com.ktc4.pusan4.judgment.domain.JudgmentRun;
import com.ktc4.pusan4.judgment.domain.JudgmentRunFailure;
import com.ktc4.pusan4.shared.UuidGenerator;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.user.domain.BusinessContext;
import com.ktc4.pusan4.user.persistence.BusinessContextService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 판정 실행 (api.md 3.6). 만들 때 대상 거래를 고정하고, 커밋 뒤 JudgmentRunner 가 비동기로 한 건씩 판정한다.
 * 진행 상황은 GET 폴링으로 본다.
 */
@Service
public class JudgmentRunService {

    private final JudgmentRunRepository runRepository;
    private final JudgmentRunItemRepository itemRepository;
    private final UploadBatchRepository batchRepository;
    private final TransactionRecordRepository transactionRepository;
    private final BusinessContextService contextService;
    private final JudgmentExecutor executor;
    private final ApplicationEventPublisher eventPublisher;
    private final UuidGenerator uuidGenerator;
    private final Clock clock;

    public JudgmentRunService(
        JudgmentRunRepository runRepository,
        JudgmentRunItemRepository itemRepository,
        UploadBatchRepository batchRepository,
        TransactionRecordRepository transactionRepository,
        BusinessContextService contextService,
        JudgmentExecutor executor,
        ApplicationEventPublisher eventPublisher,
        UuidGenerator uuidGenerator,
        Clock clock
    ) {
        this.runRepository = runRepository;
        this.itemRepository = itemRepository;
        this.batchRepository = batchRepository;
        this.transactionRepository = transactionRepository;
        this.contextService = contextService;
        this.executor = executor;
        this.eventPublisher = eventPublisher;
        this.uuidGenerator = uuidGenerator;
        this.clock = clock;
    }

    /**
     * 대상(판정대상이면서 분류 완료)을 run 항목으로 고정하고 QUEUED 로 만든다.
     * 실행은 이 트랜잭션이 커밋된 뒤 시작된다(JudgmentRunner).
     */
    @Transactional
    public JudgmentRun create(UUID userId, UUID batchId, UUID contextId) {
        if (!batchRepository.existsByIdAndUserId(batchId, userId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "BATCH_NOT_FOUND", "업로드를 찾을 수 없습니다.");
        }
        BusinessContext context = contextService.find(userId, contextId);
        List<UUID> targetIds = transactionRepository.findRunTargetIds(batchId);

        UUID runId = uuidGenerator.generate();
        JudgmentRunEntity run = runRepository.save(
            new JudgmentRunEntity(runId, batchId, contextId, context.version(), targetIds.size())
        );
        itemRepository.saveAll(targetIds.stream()
            .map(transactionId -> new JudgmentRunItemEntity(runId, transactionId))
            .toList());
        eventPublisher.publishEvent(new JudgmentRunCreated(runId));
        return run.toDomain();
    }

    @Transactional(readOnly = true)
    public JudgmentRun get(UUID userId, UUID runId) {
        return findForUser(userId, runId).toDomain();
    }

    @Transactional(readOnly = true)
    public Page<JudgmentRunFailure> failures(UUID userId, UUID runId, int page, int size) {
        findForUser(userId, runId);
        return itemRepository.findFailures(runId, PageRequest.of(page, size))
            .map(JudgmentRunItemEntity::toFailure);
    }

    // 아래는 JudgmentRunner 가 단계마다 따로 커밋하려고 부르는 메서드다.

    @Transactional
    RunStart start(UUID runId) {
        JudgmentRunEntity run = runRepository.findById(runId).orElseThrow();
        UUID userId = batchRepository.findById(run.batchId()).orElseThrow().userId();
        BusinessContext context = contextService.find(userId, run.contextId());
        run.start(now());
        return new RunStart(context, itemRepository.findPendingTransactionIds(runId));
    }

    /** 판정 저장과 항목 성공 기록을 한 트랜잭션으로 묶는다. 판정이 실패하면 둘 다 롤백된다. */
    @Transactional
    void judgeItem(UUID runId, UUID transactionId, BusinessContext context) {
        executor.judge(transactionId, context, new JudgmentOrigin(JudgmentOriginType.RUN, runId));
        item(runId, transactionId).succeed(now());
        runRepository.findById(runId).orElseThrow().recordSuccess();
    }

    @Transactional
    void recordFailure(UUID runId, UUID transactionId) {
        item(runId, transactionId).fail(now());
        runRepository.findById(runId).orElseThrow().recordFailure();
    }

    @Transactional
    void complete(UUID runId) {
        runRepository.findById(runId).orElseThrow().complete(now());
    }

    @Transactional
    void fail(UUID runId) {
        runRepository.findById(runId).orElseThrow().fail(now());
    }

    private JudgmentRunEntity findForUser(UUID userId, UUID runId) {
        return runRepository.findForUser(runId, userId)
            .orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND, "JUDGMENT_RUN_NOT_FOUND", "판정 실행을 찾을 수 없습니다."
            ));
    }

    private JudgmentRunItemEntity item(UUID runId, UUID transactionId) {
        return itemRepository.findById(new JudgmentRunItemEntity.Key(runId, transactionId)).orElseThrow();
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock);
    }

    record RunStart(BusinessContext context, List<UUID> transactionIds) {
    }
}
