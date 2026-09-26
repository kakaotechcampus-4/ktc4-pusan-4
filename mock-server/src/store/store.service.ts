import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  BusinessContextEntity,
  ClassificationReviewEntity,
  IdempotencyRecord,
  JudgmentEntity,
  JudgmentOverrideEntity,
  JudgmentRunEntity,
  QuestionEntity,
  StatuteEntity,
  TransactionEntity,
  UploadBatchEntity,
  UserEntity,
  UserFactEntity,
} from './entities';

/**
 * 인메모리 데이터 저장 전체. 실사용처가 이 서비스 하나뿐이라 리포지토리/인터페이스
 * 계층을 별도로 두지 않는다 (mock-server 계획 "모듈 구조" 참조).
 */
@Injectable()
export class StoreService {
  users: UserEntity[] = [];
  contexts: BusinessContextEntity[] = [];
  uploadBatches: UploadBatchEntity[] = [];
  idempotencyRecords = new Map<string, IdempotencyRecord>();
  transactions: TransactionEntity[] = [];
  classificationReviews: ClassificationReviewEntity[] = [];
  judgmentRuns: JudgmentRunEntity[] = [];
  judgments: JudgmentEntity[] = [];
  userFacts: UserFactEntity[] = [];
  judgmentOverrides: JudgmentOverrideEntity[] = [];
  questions: QuestionEntity[] = [];
  statutes: StatuteEntity[] = [];

  newId(): string {
    return uuidv7();
  }

  currentUser(): UserEntity {
    return this.users[0];
  }

  currentContext(): BusinessContextEntity | undefined {
    return this.contexts.filter((c) => c.userId === this.currentUser().id).sort((a, b) => b.version - a.version)[0];
  }

  judgmentsFor(transactionId: string): JudgmentEntity[] {
    return this.judgments.filter((j) => j.transactionId === transactionId);
  }

  latestJudgment(transactionId: string): JudgmentEntity | undefined {
    return this.judgmentsFor(transactionId).sort((a, b) => b.revision - a.revision)[0];
  }

  currentJudgment(transactionId: string): JudgmentEntity | undefined {
    const judgments = this.judgmentsFor(transactionId);
    const activeOverrideIds = new Set(this.judgmentOverrides.filter((o) => o.active).map((o) => o.id));
    const activeOverride = judgments
      .filter((j) => j.origin.type === 'OVERRIDE' && activeOverrideIds.has(j.origin.id))
      .sort((a, b) => b.revision - a.revision)[0];
    if (activeOverride) return activeOverride;
    return judgments.filter((j) => j.origin.type !== 'OVERRIDE').sort((a, b) => b.revision - a.revision)[0];
  }

  nextRevision(transactionId: string): number {
    const revisions = this.judgmentsFor(transactionId).map((j) => j.revision);
    return revisions.length > 0 ? Math.max(...revisions) + 1 : 1;
  }

  effectiveTransactionsFor(batchId: string): TransactionEntity[] {
    return this.transactions.filter((t) => t.batchId === batchId);
  }
}
