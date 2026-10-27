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
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 판정 실행 (api.md 3.6). 만들 때 대상 거래를 고정하고, 커밋 뒤 JudgmentRunner 가 비동기로 한 건씩 판정한다.
 * 진행 상황은 GET 폴링으로 본다.
 *
 * <p>실행은 서버 메모리의 비동기 큐에서 돌아서, 서버가 내려가면 run 이 QUEUED·RUNNING 으로 남는다.
 * 이어 돌리지 않고 interruptStale 이 실패로 끝내 사용자에게 보인다. 사용자는 run 을 다시 만든다.
 */
@Service
public class JudgmentRunService {

    /** 거래 한 건 판정은 짧다. 이만큼 진행이 없으면 실행하던 서버가 내려간 것으로 본다. */
    static final Duration STALE_AFTER = Duration.ofMinutes(5);

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
            new JudgmentRunEntity(runId, batchId, contextId, context.version(), targetIds.size(), now())
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
    // 모두 run 행을 잠그고 상태를 확인한다. interruptStale 이 먼저 끝낸 run 은 건드리지 않는다.

    /** QUEUED 가 아니면(이미 중단으로 끝났으면) 시작하지 않는다. */
    @Transactional
    Optional<RunStart> start(UUID runId) {
        JudgmentRunEntity run = lock(runId);
        if (!run.isQueued()) {
            return Optional.empty();
        }
        UUID userId = batchRepository.findById(run.batchId()).orElseThrow().userId();
        BusinessContext context = contextService.find(userId, run.contextId());
        run.start(now());
        return Optional.of(new RunStart(
            context, itemRepository.findPendingTransactionIds(runId), executor.references()
        ));
    }

    /**
     * 판정 저장과 항목 성공 기록을 한 트랜잭션으로 묶는다. 판정이 실패하면 둘 다 롤백된다.
     * run 이 이미 끝났으면 판정하지 않고 false 를 돌려준다. 실행기는 거기서 멈춘다.
     */
    @Transactional
    boolean judgeItem(UUID runId, UUID transactionId, BusinessContext context, JudgmentReferences references) {
        JudgmentRunEntity run = lock(runId);
        if (!run.isRunning()) {
            return false;
        }
        executor.judge(transactionId, context, new JudgmentOrigin(JudgmentOriginType.RUN, runId), references);
        item(runId, transactionId).succeed(now());
        run.recordSuccess(now());
        return true;
    }

    @Transactional
    void recordFailure(UUID runId, UUID transactionId) {
        JudgmentRunEntity run = lock(runId);
        if (!run.isRunning()) {
            return;
        }
        item(runId, transactionId).fail(now());
        run.recordFailure(now());
    }

    @Transactional
    void complete(UUID runId) {
        JudgmentRunEntity run = lock(runId);
        if (run.isRunning()) {
            run.complete(now());
        }
    }

    /**
     * run 을 시작하지 못했다(Context 를 읽지 못함, 판정 대기열이 가득 참 등). 남은 PENDING 항목은 RUN_START_FAILED 실패가 되어 실패 목록에 보인다.
     * 대기열이 찬 경우는 run 을 만든 트랜잭션의 커밋 뒤(AFTER_COMMIT)에 불린다. 그때 REQUIRED 로 들어가면 이미 끝난
     * 트랜잭션에 참여해 바꾼 내용이 커밋되지 않으므로 새 트랜잭션을 연다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void fail(UUID runId) {
        JudgmentRunEntity run = lock(runId);
        if (run.isQueued() || run.isRunning()) {
            itemRepository.failPending(
                runId, JudgmentRunItemError.RUN_START_FAILED, JudgmentRunItemError.RUN_START_FAILED.message(), now()
            );
            run.fail(now());
        }
    }

    /**
     * 진행이 STALE_AFTER 넘게 없는 QUEUED·RUNNING run 을 끝낸다. 남은 PENDING 항목은 RUN_INTERRUPTED 실패가 된다.
     * 서버 기동 시각이 아니라 진행 시각으로 보므로, 서버가 여러 대여도 다른 서버에서 도는 run 은 끝내지 않는다.
     */
    @Transactional
    void interruptStale() {
        OffsetDateTime now = now();
        for (JudgmentRunEntity run : runRepository.findStaleForUpdate(now.minus(STALE_AFTER))) {
            int interrupted = itemRepository.failPending(
                run.id(), JudgmentRunItemError.RUN_INTERRUPTED, JudgmentRunItemError.RUN_INTERRUPTED.message(), now
            );
            run.interrupt(interrupted, now);
        }
    }

    private JudgmentRunEntity findForUser(UUID userId, UUID runId) {
        return runRepository.findForUser(runId, userId)
            .orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND, "JUDGMENT_RUN_NOT_FOUND", "판정 실행을 찾을 수 없습니다."
            ));
    }

    private JudgmentRunEntity lock(UUID runId) {
        return runRepository.findByIdForUpdate(runId).orElseThrow();
    }

    private JudgmentRunItemEntity item(UUID runId, UUID transactionId) {
        return itemRepository.findById(new JudgmentRunItemEntity.Key(runId, transactionId)).orElseThrow();
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock);
    }

    record RunStart(BusinessContext context, List<UUID> transactionIds, JudgmentReferences references) {
    }
}
