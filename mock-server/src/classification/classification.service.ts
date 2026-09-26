import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { REVIEW_STATUS_LABELS, coded } from '../common/coded';
import { isValidMerchantCategory } from '../common/merchant-category';
import { mockJudgmentFields, pickVerdictForCategory } from '../common/mock-verdict';
import { paginate } from '../common/pagination';
import { nowKst } from '../common/time';
import { ClassificationReviewEntity } from '../store/entities';
import { StoreService } from '../store/store.service';

export interface ReviewListQuery {
  batchId?: string;
  status?: string;
  grouped?: boolean;
  page?: number;
  size?: number;
}

@Injectable()
export class ClassificationService {
  constructor(private readonly store: StoreService) {}

  private toReviewResponse(review: ClassificationReviewEntity) {
    return {
      id: review.id,
      batchId: review.batchId,
      transactionId: review.transactionId,
      merchantRaw: review.merchantRaw,
      merchantNorm: review.merchantNorm,
      status: coded(review.status, REVIEW_STATUS_LABELS),
      suggestedCategories: review.suggestedCategories,
      createdAt: review.createdAt,
      resolvedAt: review.resolvedAt,
    };
  }

  listReviews(query: ReviewListQuery) {
    let items = [...this.store.classificationReviews];
    if (query.batchId) items = items.filter((r) => r.batchId === query.batchId);
    if (query.status) items = items.filter((r) => r.status === query.status);
    items.sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    if (query.grouped) {
      const groups = new Map<string, ClassificationReviewEntity[]>();
      for (const review of items) {
        const key = `merchant:${review.merchantNorm}`;
        const list = groups.get(key) ?? [];
        list.push(review);
        groups.set(key, list);
      }
      const groupItems = Array.from(groups.entries()).map(([groupKey, reviews]) => ({
        groupKey,
        reviewIds: reviews.map((r) => r.id),
        count: reviews.length,
        totalAmount: reviews.reduce(
          (sum, r) => sum + (this.store.transactions.find((t) => t.id === r.transactionId)?.amount ?? 0),
          0,
        ),
        merchantRaw: reviews[0].merchantRaw,
        suggestedCategories: reviews[0].suggestedCategories,
      }));
      return paginate(groupItems, query.page, query.size);
    }

    const page = paginate(items, query.page, query.size);
    return { items: page.items.map((r) => this.toReviewResponse(r)), page: page.page };
  }

  respond(reviewIds: string[], merchantCategory: string) {
    if (merchantCategory === '미분류') {
      throw new ApiError(422, 'UNCLASSIFIED_CATEGORY_NOT_ALLOWED', "'미분류'는 분류 응답으로 제출할 수 없습니다.");
    }
    if (!isValidMerchantCategory(merchantCategory)) {
      throw new ApiError(422, 'INVALID_MERCHANT_CATEGORY', '허용되지 않는 카테고리입니다.');
    }

    const reviews = reviewIds.map((id) => {
      const review = this.store.classificationReviews.find((r) => r.id === id);
      if (!review) throw new ApiError(404, 'CLASSIFICATION_REVIEW_NOT_FOUND', '요청한 분류 확인 항목을 찾을 수 없습니다.');
      return review;
    });
    // question-responses의 QUESTIONS_FROM_DIFFERENT_BATCHES와 대칭되는 안전장치.
    // 이게 없으면 서로 다른 배치의 review를 한 요청에 섞었을 때, 아래 로직이 reviews[0]의
    // batchId 기준으로만 "Run이 있는지"를 판단해 엉뚱한 배치 거래까지 판정해버린다.
    if (new Set(reviews.map((r) => r.batchId)).size > 1) {
      throw new ApiError(422, 'REVIEWS_FROM_DIFFERENT_BATCHES', '서로 다른 배치의 분류 확인 항목을 함께 응답할 수 없습니다.');
    }
    if (reviews.some((r) => r.status !== 'PENDING')) {
      throw new ApiError(409, 'CLASSIFICATION_ALREADY_RESOLVED', '이미 처리된 분류 확인 항목이 포함되어 있습니다.');
    }

    const batchId = reviews[0].batchId;
    const completedRuns = this.store.judgmentRuns.filter((r) => r.batchId === batchId && r.completedAt !== null);
    const latestRun = [...completedRuns].sort((a, b) => {
      if (a.startedAt !== b.startedAt) return (a.startedAt ?? '') < (b.startedAt ?? '') ? 1 : -1;
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    })[0];
    let judgedCount = 0;

    for (const review of reviews) {
      review.status = 'RESOLVED';
      review.resolvedAt = nowKst();

      const tx = this.store.transactions.find((t) => t.id === review.transactionId);
      if (!tx) continue;
      tx.merchantCategory = merchantCategory;
      tx.classificationStatus = 'CLASSIFIED';

      if (latestRun) {
        const verdict = pickVerdictForCategory(merchantCategory);
        const { blockedAtGate, account, finalAmount, outOfScope } = mockJudgmentFields(
          verdict,
          tx.amount,
          merchantCategory,
        );
        this.store.judgments.push({
          id: this.store.newId(),
          transactionId: tx.id,
          revision: this.store.nextRevision(tx.id),
          origin: { type: 'CLASSIFICATION_REVIEW', id: review.id },
          runId: null,
          verdict,
          outOfScope,
          blockedAtGate,
          account,
          finalAmount,
          isInference: false,
          unmatchedReason: null,
          attributes: {},
          ruleCardId: null,
          ruleCardVersion: null,
          appliedRuleIds: [],
          rulesCommitSha: 'seed0000000000000000000000000000000000',
          userContextVersion: latestRun.contextVersion,
          explanation: `${merchantCategory} 분류 확정 후 재판정되었습니다.`,
          computedAt: nowKst(),
          citations: [],
        });
        judgedCount++;
      }
    }

    return { resolvedCount: reviews.length, merchantCategory, judgedCount };
  }
}
