import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { VERDICT_LABELS, Verdict, coded, computeEffectiveStatus } from '../common/coded';
import { paginate } from '../common/pagination';
import { nowKst } from '../common/time';
import { JudgmentEntity } from '../store/entities';
import { StoreService } from '../store/store.service';

export interface JudgmentListQuery {
  transactionId?: string;
  batchId?: string;
  year?: string;
  verdict?: string;
  latestOnly?: boolean;
  runId?: string;
  page?: number;
  size?: number;
}

export interface SummaryQuery {
  batchId?: string;
  year?: string;
  runId?: string;
}

@Injectable()
export class JudgmentsService {
  constructor(private readonly store: StoreService) {}

  private toResponse(j: JudgmentEntity) {
    return {
      id: j.id,
      transactionId: j.transactionId,
      revision: j.revision,
      origin: j.origin,
      verdict: coded(j.verdict, VERDICT_LABELS),
      outOfScope: j.outOfScope,
      blockedAtGate: j.blockedAtGate,
      account: j.account,
      finalAmount: j.finalAmount,
      isInference: j.isInference,
      unmatchedReason: j.unmatchedReason,
      attributes: j.attributes,
      ruleCardId: j.ruleCardId,
      ruleCardVersion: j.ruleCardVersion,
      appliedRuleIds: j.appliedRuleIds,
      rulesCommitSha: j.rulesCommitSha,
      userContextVersion: j.userContextVersion,
      explanation: j.explanation,
      computedAt: j.computedAt,
      citations: j.citations,
    };
  }

  /** docs/api.md 5장: effectiveStatus=JUDGEABLE AND classificationStatus=CLASSIFIED인 거래만 "현재 결과" 대상. */
  private currentTransactionIds(scope: { batchId?: string; year?: string }): Set<string> {
    let txs = this.store.transactions;
    if (scope.batchId) txs = txs.filter((t) => t.batchId === scope.batchId);
    if (scope.year) txs = txs.filter((t) => t.approvedAt.startsWith(scope.year!));
    return new Set(
      txs
        .filter(
          (t) =>
            computeEffectiveStatus(t.sourceStatus, t.userInclusion) === 'JUDGEABLE' &&
            t.classificationStatus === 'CLASSIFIED',
        )
        .map((t) => t.id),
    );
  }

  private currentPerTransaction(items: JudgmentEntity[]): JudgmentEntity[] {
    const transactionIds = new Set(items.map((j) => j.transactionId));
    return Array.from(transactionIds)
      .map((transactionId) => this.store.currentJudgment(transactionId))
      .filter((j): j is JudgmentEntity => j !== undefined);
  }

  list(query: JudgmentListQuery) {
    let items = [...this.store.judgments];

    if (query.transactionId) {
      items = items.filter((j) => j.transactionId === query.transactionId);
      const latestOnly = query.latestOnly ?? true;
      if (latestOnly) items = this.currentPerTransaction(items);
    } else if (query.runId) {
      items = items.filter((j) => j.runId === query.runId);
    } else if (query.batchId || query.year) {
      const currentIds = this.currentTransactionIds({ batchId: query.batchId, year: query.year });
      items = this.currentPerTransaction(items.filter((j) => currentIds.has(j.transactionId)));
    }

    if (query.verdict) items = items.filter((j) => j.verdict === query.verdict);

    items.sort((a, b) => {
      if (a.computedAt !== b.computedAt) return a.computedAt < b.computedAt ? 1 : -1;
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    });

    const page = paginate(items, query.page, query.size);
    return { items: page.items.map((j) => this.toResponse(j)), page: page.page };
  }

  summary(scope: SummaryQuery) {
    const provided = [scope.batchId, scope.year, scope.runId].filter(Boolean).length;
    if (provided !== 1) {
      throw new ApiError(400, 'INVALID_SUMMARY_SCOPE', 'batchId, year, runId 중 정확히 하나를 지정해야 합니다.');
    }

    let items: JudgmentEntity[];
    let scopeResponse: { type: string; id: string };

    if (scope.runId) {
      items = this.store.judgments.filter((j) => j.runId === scope.runId);
      scopeResponse = { type: 'RUN', id: scope.runId };
    } else {
      const currentIds = this.currentTransactionIds({ batchId: scope.batchId, year: scope.year });
      items = this.currentPerTransaction(this.store.judgments.filter((j) => currentIds.has(j.transactionId)));
      scopeResponse = scope.batchId ? { type: 'BATCH', id: scope.batchId } : { type: 'YEAR', id: scope.year! };
    }

    const byVerdict: Record<Verdict, { count: number; finalAmount: number }> = {
      AVAILABLE: { count: 0, finalAmount: 0 },
      UNAVAILABLE: { count: 0, finalAmount: 0 },
      NEEDS_REVIEW: { count: 0, finalAmount: 0 },
    };
    const byAccountMap = new Map<string, { count: number; finalAmount: number }>();

    for (const j of items) {
      byVerdict[j.verdict].count++;
      byVerdict[j.verdict].finalAmount += j.finalAmount ?? 0;
      if (j.account) {
        const entry = byAccountMap.get(j.account) ?? { count: 0, finalAmount: 0 };
        entry.count++;
        entry.finalAmount += j.finalAmount ?? 0;
        byAccountMap.set(j.account, entry);
      }
    }

    return {
      scope: scopeResponse,
      totalCount: items.length,
      byVerdict,
      byAccount: Array.from(byAccountMap.entries()).map(([account, v]) => ({ account, ...v })),
    };
  }

  private findOrThrow(judgmentId: string): JudgmentEntity {
    const j = this.store.judgments.find((x) => x.id === judgmentId);
    if (!j) throw new ApiError(404, 'JUDGMENT_NOT_FOUND', '요청한 판정을 찾을 수 없습니다.');
    return j;
  }

  detail(judgmentId: string) {
    return this.toResponse(this.findOrThrow(judgmentId));
  }

  override(judgmentId: string, toVerdict: Verdict, reason: string) {
    const source = this.findOrThrow(judgmentId);
    const createdAt = nowKst();

    for (const existing of this.store.judgmentOverrides.filter((o) => o.active)) {
      const existingJudgment = this.store.judgments.find(
        (j) => j.origin.type === 'OVERRIDE' && j.origin.id === existing.id,
      );
      if (existingJudgment?.transactionId === source.transactionId) {
        existing.active = false;
        existing.releasedAt = createdAt;
      }
    }

    const overrideId = this.store.newId();
    this.store.judgmentOverrides.push({
      id: overrideId,
      sourceJudgmentId: source.id,
      toVerdict,
      reason,
      active: true,
      createdAt,
      releasedAt: null,
    });

    const newJudgment: JudgmentEntity = {
      ...source,
      id: this.store.newId(),
      revision: this.store.nextRevision(source.transactionId),
      origin: { type: 'OVERRIDE', id: overrideId },
      runId: null,
      verdict: toVerdict,
      // 불변식: outOfScope는 NEEDS_REVIEW에서만 true. 다른 verdict로 override하면 반드시 리셋한다.
      outOfScope: toVerdict === 'NEEDS_REVIEW' ? source.outOfScope : false,
      computedAt: createdAt,
    };
    this.store.judgments.push(newJudgment);
    return this.toResponse(newJudgment);
  }

  releaseOverride(overrideId: string): void {
    const override = this.store.judgmentOverrides.find((o) => o.id === overrideId);
    if (!override) {
      throw new ApiError(404, 'JUDGMENT_OVERRIDE_NOT_FOUND', '요청한 판정 수정을 찾을 수 없습니다.');
    }
    if (!override.active) return;
    override.active = false;
    override.releasedAt = nowKst();
  }
}
