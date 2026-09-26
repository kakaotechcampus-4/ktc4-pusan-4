import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { RUN_STATUS_LABELS, coded, computeEffectiveStatus } from '../common/coded';
import { mockJudgmentFields, pickVerdictForCategory } from '../common/mock-verdict';
import { paginate } from '../common/pagination';
import { nowKst } from '../common/time';
import { JudgmentRunEntity } from '../store/entities';
import { StoreService } from '../store/store.service';

/** GET 호출 3회면 QUEUED → RUNNING → COMPLETED로 진행하도록 흉내낸다 (타이머 없이 poll 횟수 기반). */
const PROGRESS_STEPS = 3;

@Injectable()
export class JudgmentRunsService {
  constructor(private readonly store: StoreService) {}

  create(batchId: string, contextId: string) {
    const batch = this.store.uploadBatches.find((b) => b.id === batchId);
    if (!batch) throw new ApiError(404, 'BATCH_NOT_FOUND', '요청한 배치를 찾을 수 없습니다.');
    const context = this.store.contexts.find((c) => c.id === contextId);
    if (!context) throw new ApiError(404, 'CONTEXT_NOT_FOUND', '요청한 사업자 정보를 찾을 수 없습니다.');

    const targets = this.store.transactions.filter(
      (t) =>
        t.batchId === batchId &&
        computeEffectiveStatus(t.sourceStatus, t.userInclusion) === 'JUDGEABLE' &&
        t.classificationStatus === 'CLASSIFIED',
    );

    const runId = this.store.newId();
    const run: JudgmentRunEntity = {
      id: runId,
      batchId,
      contextId,
      contextVersion: context.version,
      totalCount: targets.length,
      failedCount: 0,
      startedAt: null,
      completedAt: null,
      pollCount: 0,
    };
    this.store.judgmentRuns.push(run);

    // mock: 실제 판정은 POST 시점에 동기적으로 즉시 만들어두고, GET polling에서는
    // 진행률(QUEUED→RUNNING→COMPLETED)만 흉내낸다 (judgment-runs 계획의 "진행 시뮬레이션" 참고).
    for (const tx of targets) {
      const verdict = pickVerdictForCategory(tx.merchantCategory);
      const { blockedAtGate, account, finalAmount, outOfScope } = mockJudgmentFields(
        verdict,
        tx.amount,
        tx.merchantCategory,
      );
      this.store.judgments.push({
        id: this.store.newId(),
        transactionId: tx.id,
        revision: this.store.nextRevision(tx.id),
        origin: { type: 'RUN', id: runId },
        runId,
        verdict,
        outOfScope,
        blockedAtGate,
        account,
        finalAmount,
        isInference: false,
        unmatchedReason: null,
        attributes: {},
        ruleCardId: 'R-900',
        ruleCardVersion: 1,
        appliedRuleIds: ['R-900'],
        rulesCommitSha: 'seed0000000000000000000000000000000000',
        userContextVersion: context.version,
        explanation: `${tx.merchantCategory} 카테고리 기준 mock 판정 결과입니다.`,
        computedAt: nowKst(),
        citations: [],
      });
    }

    return {
      id: run.id,
      batchId: run.batchId,
      contextId: run.contextId,
      contextVersion: run.contextVersion,
      status: coded('QUEUED', RUN_STATUS_LABELS),
      totalCount: run.totalCount,
    };
  }

  private findOrThrow(runId: string): JudgmentRunEntity {
    const run = this.store.judgmentRuns.find((r) => r.id === runId);
    if (!run) throw new ApiError(404, 'JUDGMENT_RUN_NOT_FOUND', '요청한 판정 실행을 찾을 수 없습니다.');
    return run;
  }

  get(runId: string) {
    const run = this.findOrThrow(runId);

    if (run.completedAt === null) {
      run.pollCount += 1;
      run.startedAt ??= nowKst();
      if (Math.min(run.pollCount, PROGRESS_STEPS) >= PROGRESS_STEPS) {
        run.completedAt = nowKst();
      }
    }

    const statusCode = run.completedAt ? 'COMPLETED' : run.pollCount <= 1 ? 'QUEUED' : 'RUNNING';
    const processedCount = run.completedAt
      ? run.totalCount
      : Math.round((run.totalCount * Math.min(run.pollCount, PROGRESS_STEPS)) / PROGRESS_STEPS);

    return {
      id: run.id,
      batchId: run.batchId,
      contextId: run.contextId,
      contextVersion: run.contextVersion,
      status: coded(statusCode, RUN_STATUS_LABELS),
      totalCount: run.totalCount,
      processedCount,
      failedCount: run.failedCount,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
    };
  }

  failures(runId: string, page?: number, size?: number) {
    this.findOrThrow(runId);
    // mock: 기술적 실패는 재현하지 않는다 (충실도 노트 참고). 항상 빈 페이지를 반환한다.
    return paginate<never>([], page, size);
  }
}
