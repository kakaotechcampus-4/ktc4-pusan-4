import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { QUESTION_STATUS_LABELS, coded } from '../common/coded';
import { isOutOfScope } from '../common/mock-verdict';
import { paginate } from '../common/pagination';
import { nowKst } from '../common/time';
import { QUESTION_ANSWER_VERDICT } from '../seed/seed-data';
import { QuestionEntity } from '../store/entities';
import { StoreService } from '../store/store.service';

export interface QuestionListQuery {
  batchId?: string;
  transactionId?: string;
  status?: string;
  grouped?: boolean;
  page?: number;
  size?: number;
}

@Injectable()
export class QuestionsService {
  constructor(private readonly store: StoreService) {}

  private toResponse(q: QuestionEntity) {
    return {
      id: q.id,
      batchId: q.batchId,
      transactionId: q.transactionId,
      groupKey: q.groupKey,
      factType: q.factType,
      questionText: q.questionText,
      options: q.options,
      status: coded(q.status, QUESTION_STATUS_LABELS),
      answeredFactId: q.answeredFactId,
      createdAt: q.createdAt,
      answeredAt: q.answeredAt,
    };
  }

  private unresolved(questions: QuestionEntity[]) {
    const pending = questions.filter((q) => q.status === 'PENDING');
    const transactionIds = new Set(pending.map((q) => q.transactionId));
    const amount = this.store.transactions
      .filter((transaction) => transactionIds.has(transaction.id))
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    return { count: pending.length, amount };
  }

  private createFact(batchId: string, scopeKey: string, factType: string, value: string, createdAt: string) {
    const previousVersions = this.store.userFacts
      .filter(
        (fact) => fact.batchId === batchId && fact.scopeKey === scopeKey && fact.factType === factType,
      )
      .map((fact) => fact.version);
    const id = this.store.newId();
    this.store.userFacts.push({
      id,
      userId: this.store.currentUser().id,
      batchId,
      scopeKey,
      factType,
      value,
      version: previousVersions.length > 0 ? Math.max(...previousVersions) + 1 : 1,
      createdAt,
    });
    return id;
  }

  private rejudge(transactionId: string, groupKey: string, factId: string, answerValue: string, explanation: string) {
    const transaction = this.store.transactions.find((item) => item.id === transactionId);
    if (!transaction) return;
    const previous = this.store.latestJudgment(transactionId);
    const verdict = QUESTION_ANSWER_VERDICT[groupKey]?.[answerValue] ?? 'AVAILABLE';
    this.store.judgments.push({
      id: this.store.newId(),
      transactionId,
      revision: this.store.nextRevision(transactionId),
      origin: { type: 'USER_FACT', id: factId },
      runId: null,
      verdict,
      outOfScope: isOutOfScope(verdict, transaction.merchantCategory),
      blockedAtGate: null,
      account: previous?.account ?? null,
      finalAmount: verdict === 'AVAILABLE' ? transaction.amount : null,
      isInference: false,
      unmatchedReason: null,
      attributes: {},
      ruleCardId: previous?.ruleCardId ?? null,
      ruleCardVersion: previous?.ruleCardVersion ?? null,
      appliedRuleIds: previous?.appliedRuleIds ?? [],
      rulesCommitSha: previous?.rulesCommitSha ?? 'seed0000000000000000000000000000000000',
      userContextVersion: previous?.userContextVersion ?? 1,
      explanation,
      computedAt: nowKst(),
      citations: previous?.citations ?? [],
    });
  }

  list(query: QuestionListQuery) {
    let scopedItems = [...this.store.questions];
    if (query.batchId) scopedItems = scopedItems.filter((q) => q.batchId === query.batchId);
    if (query.transactionId) scopedItems = scopedItems.filter((q) => q.transactionId === query.transactionId);
    const unresolved = this.unresolved(scopedItems);

    let items = scopedItems;
    if (query.status) items = items.filter((q) => q.status === query.status);
    items.sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    if (query.grouped) {
      const groups = new Map<string, QuestionEntity[]>();
      for (const q of items) {
        const key = `${q.groupKey}\u0000${q.factType}`;
        const list = groups.get(key) ?? [];
        list.push(q);
        groups.set(key, list);
      }
      const groupItems = Array.from(groups.values()).map((qs) => ({
        groupKey: qs[0].groupKey,
        factType: qs[0].factType,
        questionIds: qs.map((q) => q.id),
        count: qs.length,
        totalAmount: qs.reduce(
          (sum, q) => sum + (this.store.transactions.find((t) => t.id === q.transactionId)?.amount ?? 0),
          0,
        ),
        questionText: qs[0].questionText,
        options: qs[0].options,
      }));
      return { ...paginate(groupItems, query.page, query.size), unresolved };
    }

    const page = paginate(items, query.page, query.size);
    return { items: page.items.map((q) => this.toResponse(q)), unresolved, page: page.page };
  }

  respond(questionIds: string[], answerValue: string) {
    const questions = questionIds.map((id) => {
      const q = this.store.questions.find((x) => x.id === id);
      if (!q) throw new ApiError(404, 'QUESTION_NOT_FOUND', '요청한 질문을 찾을 수 없습니다.');
      return q;
    });

    if (new Set(questions.map((q) => q.batchId)).size > 1) {
      throw new ApiError(422, 'QUESTIONS_FROM_DIFFERENT_BATCHES', '서로 다른 배치의 질문을 함께 응답할 수 없습니다.');
    }
    if (
      new Set(questions.map((q) => q.groupKey)).size > 1 ||
      new Set(questions.map((q) => q.factType)).size > 1
    ) {
      throw new ApiError(409, 'QUESTION_GROUP_MISMATCH', '서로 다른 질문 그룹을 함께 응답할 수 없습니다.');
    }
    if (questions.some((q) => q.status === 'CANCELED')) {
      throw new ApiError(409, 'QUESTION_NOT_ANSWERABLE', '취소된 질문에는 응답할 수 없습니다.');
    }
    if (!questions[0].options.includes(answerValue)) {
      throw new ApiError(422, 'INVALID_ANSWER_VALUE', '허용되지 않는 응답 값입니다.');
    }

    const groupKey = questions[0].groupKey;
    const batchId = questions[0].batchId;

    // docs/api.md 3.10 4단계: "동일 Batch에서 Fact의 scope가 영향을 주는 Transaction 조회".
    // 요청에 명시된 questionIds만이 아니라, 같은 배치·같은 scope(groupKey)의 다른 PENDING
    // 질문도 이 답변의 영향을 받는다 — scope를 상호 1개 단위로 쪼갰으므로(seed-data.ts 참고)
    // 같은 groupKey는 항상 같은 상호를 가리킨다.
    const factType = questions[0].factType;
    const siblingQuestions = this.store.questions.filter(
      (q) =>
        q.batchId === batchId &&
        q.groupKey === groupKey &&
        q.factType === factType &&
        q.status === 'PENDING' &&
        !questions.includes(q),
    );
    const affectedQuestions = [...questions, ...siblingQuestions];

    const answeredAt = nowKst();
    const factId = this.createFact(batchId, groupKey, factType, answerValue, answeredAt);
    for (const q of affectedQuestions) {
      q.status = 'ANSWERED';
      q.answeredFactId = factId;
      q.answeredAt = answeredAt;
    }

    const transactionIds = Array.from(new Set(affectedQuestions.map((q) => q.transactionId)));

    for (const transactionId of transactionIds) {
      this.rejudge(
        transactionId,
        groupKey,
        factId,
        answerValue,
        `사용자 응답("${answerValue}")을 반영해 재판정되었습니다.`,
      );

      // mock: 실제 룰엔진의 "더 이상 불필요" 판정 대신, 같은 거래를 겨냥한 다른
      // PENDING 질문을 기계적으로 취소한다 (충실도 노트 참고).
      for (const other of this.store.questions) {
        if (other.transactionId === transactionId && other.status === 'PENDING') {
          other.status = 'CANCELED';
        }
      }
    }

    return { answeredCount: affectedQuestions.length, factId, rejudgedTransactionCount: transactionIds.length };
  }

  bulkAnswer(batchId: string, factType: string, answerValue: string) {
    if (!this.store.uploadBatches.some((batch) => batch.id === batchId)) {
      throw new ApiError(404, 'BATCH_NOT_FOUND', '요청한 업로드 배치를 찾을 수 없습니다.');
    }

    const batchQuestions = this.store.questions.filter((question) => question.batchId === batchId);
    const factQuestions = batchQuestions.filter((question) => question.factType === factType);
    if (factQuestions.length === 0) {
      throw new ApiError(422, 'UNKNOWN_FACT_TYPE', '요청한 사실 유형의 질문이 없습니다.');
    }

    const targets = factQuestions.filter((question) => question.status === 'PENDING');
    if (targets.some((question) => !question.options.includes(answerValue))) {
      throw new ApiError(422, 'INVALID_ANSWER_VALUE', '허용되지 않는 응답 값입니다.');
    }

    const groups = new Map<string, QuestionEntity[]>();
    for (const question of targets) {
      const group = groups.get(question.groupKey) ?? [];
      group.push(question);
      groups.set(question.groupKey, group);
    }

    const factIds: string[] = [];
    const transactionIds = new Set<string>();
    const answeredAt = nowKst();
    for (const [scopeKey, questions] of groups) {
      const factId = this.createFact(batchId, scopeKey, factType, answerValue, answeredAt);
      factIds.push(factId);

      for (const question of questions) {
        question.status = 'ANSWERED';
        question.answeredFactId = factId;
        question.answeredAt = answeredAt;
        transactionIds.add(question.transactionId);
      }
    }

    for (const transactionId of transactionIds) {
      const question = targets.find((item) => item.transactionId === transactionId)!;
      const factId = question.answeredFactId!;
      this.rejudge(
        transactionId,
        question.groupKey,
        factId,
        answerValue,
        `사용자 일괄 응답("${answerValue}")을 반영해 재판정되었습니다.`,
      );
    }

    return {
      answeredCount: targets.length,
      skippedCount: batchQuestions.filter((question) => question.status === 'PENDING').length,
      factIds,
      rejudgedTransactionCount: transactionIds.size,
      unresolved: this.unresolved(batchQuestions),
    };
  }
}
