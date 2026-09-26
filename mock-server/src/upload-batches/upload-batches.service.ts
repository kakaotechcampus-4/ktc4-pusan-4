import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { paginate } from '../common/pagination';
import { nowKst } from '../common/time';
import { UploadBatchEntity } from '../store/entities';
import { StoreService } from '../store/store.service';
import { classifyMerchant } from './classify-merchant';
import { CreateUploadBatchDto } from './dto/create-upload-batch.dto';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function toBatchResponse(batch: UploadBatchEntity) {
  return {
    id: batch.id,
    sourceType: batch.sourceType,
    cardIssuer: batch.cardIssuer,
    periodStart: batch.periodStart,
    periodEnd: batch.periodEnd,
    transactionCount: batch.transactionCount,
    skippedDuplicateCount: batch.skippedDuplicateCount,
    classificationPendingCount: batch.classificationPendingCount,
    createdAt: batch.createdAt,
  };
}

@Injectable()
export class UploadBatchesService {
  constructor(private readonly store: StoreService) {}

  create(dto: CreateUploadBatchDto, idempotencyKey: string | undefined) {
    if (!idempotencyKey) {
      throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key 헤더가 필요합니다.');
    }
    const payloadHash = createHash('sha256').update(JSON.stringify(dto)).digest('hex');
    let existing = this.store.idempotencyRecords.get(idempotencyKey);
    if (existing && existing.expiresAt <= Date.now()) {
      this.store.idempotencyRecords.delete(idempotencyKey);
      existing = undefined;
    }
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', '동일한 Idempotency-Key가 다른 요청 내용으로 재사용되었습니다.');
      }
      if (existing.status === 'DELETED') {
        throw new ApiError(410, 'IDEMPOTENCY_RESULT_DELETED', '이 요청으로 생성된 업로드 배치는 이미 삭제되었습니다.');
      }
      return existing.body;
    }

    if (dto.sourceType !== '승인내역') {
      throw new ApiError(422, 'INVALID_SOURCE_TYPE', '현재는 승인내역만 업로드할 수 있습니다.');
    }
    if (dto.transactions.length === 0) {
      throw new ApiError(422, 'EMPTY_TRANSACTIONS', '거래 내역이 비어 있습니다.');
    }
    for (const tx of dto.transactions) {
      if (!tx.naturalKey) {
        throw new ApiError(422, 'MISSING_NATURAL_KEY', 'naturalKey가 없는 거래가 있습니다.');
      }
    }

    const user = this.store.currentUser();
    const userBatchIds = new Set(this.store.uploadBatches.filter((b) => b.userId === user.id).map((b) => b.id));
    if (this.store.uploadBatches.some((b) => b.userId === user.id && b.fileHash === dto.fileHash)) {
      throw new ApiError(409, 'DUPLICATE_FILE', '이미 업로드된 파일입니다.');
    }

    const existingNaturalKeys = new Set(
      this.store.transactions.filter((t) => userBatchIds.has(t.batchId)).map((t) => t.naturalKey),
    );

    const batchId = this.store.newId();
    let skippedDuplicateCount = 0;
    let classificationPendingCount = 0;
    let transactionCount = 0;
    const seenInThisBatch = new Set<string>();

    for (const txInput of dto.transactions) {
      const key = txInput.naturalKey!;
      if (existingNaturalKeys.has(key) || seenInThisBatch.has(key)) {
        skippedDuplicateCount++;
        continue;
      }
      seenInThisBatch.add(key);
      transactionCount++;

      const { merchantNorm, merchantCategory } = classifyMerchant(txInput.merchantRaw);
      const classificationStatus = merchantCategory === '미분류' ? 'NEEDS_REVIEW' : 'CLASSIFIED';
      if (classificationStatus === 'NEEDS_REVIEW') classificationPendingCount++;

      const transactionId = this.store.newId();
      this.store.transactions.push({
        id: transactionId,
        batchId,
        approvedAt: txInput.approvedAt,
        merchantRaw: txInput.merchantRaw,
        merchantNorm,
        merchantCategory,
        classificationStatus,
        amount: txInput.amount,
        installmentMonths: txInput.installmentMonths ?? 0,
        naturalKey: key,
        sourceStatus: txInput.status,
        userInclusion: 'AUTO',
      });

      if (classificationStatus === 'NEEDS_REVIEW') {
        this.store.classificationReviews.push({
          id: this.store.newId(),
          batchId,
          transactionId,
          merchantRaw: txInput.merchantRaw,
          merchantNorm,
          status: 'PENDING',
          suggestedCategories: ['기타'],
          createdAt: nowKst(),
          resolvedAt: null,
        });
      }
    }

    const batch: UploadBatchEntity = {
      id: batchId,
      userId: user.id,
      sourceType: dto.sourceType,
      cardIssuer: dto.cardIssuer,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      fileHash: dto.fileHash,
      transactionCount,
      skippedDuplicateCount,
      classificationPendingCount,
      createdAt: nowKst(),
    };
    this.store.uploadBatches.push(batch);

    const response = toBatchResponse(batch);
    this.store.idempotencyRecords.set(idempotencyKey, {
      payloadHash,
      status: 'COMPLETED',
      batchId,
      body: response,
      expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
    });
    return response;
  }

  list(page?: number, size?: number) {
    const user = this.store.currentUser();
    const items = this.store.uploadBatches
      .filter((b) => b.userId === user.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map(toBatchResponse);
    return paginate(items, page, size);
  }

  private findOrThrow(batchId: string): UploadBatchEntity {
    const batch = this.store.uploadBatches.find((b) => b.id === batchId);
    if (!batch) throw new ApiError(404, 'BATCH_NOT_FOUND', '요청한 배치를 찾을 수 없습니다.');
    return batch;
  }

  detail(batchId: string) {
    return toBatchResponse(this.findOrThrow(batchId));
  }

  remove(batchId: string): void {
    this.findOrThrow(batchId);

    const now = Date.now();
    for (const record of this.store.idempotencyRecords.values()) {
      if (record.batchId === batchId && record.expiresAt > now) record.status = 'DELETED';
    }

    const transactionIds = new Set(this.store.transactions.filter((t) => t.batchId === batchId).map((t) => t.id));
    const judgmentIds = new Set(this.store.judgments.filter((j) => transactionIds.has(j.transactionId)).map((j) => j.id));

    this.store.transactions = this.store.transactions.filter((t) => !transactionIds.has(t.id));
    this.store.classificationReviews = this.store.classificationReviews.filter((r) => r.batchId !== batchId);
    this.store.judgmentRuns = this.store.judgmentRuns.filter((r) => r.batchId !== batchId);
    this.store.judgments = this.store.judgments.filter((j) => !transactionIds.has(j.transactionId));
    this.store.questions = this.store.questions.filter((q) => q.batchId !== batchId);
    this.store.userFacts = this.store.userFacts.filter((f) => f.batchId !== batchId);
    this.store.judgmentOverrides = this.store.judgmentOverrides.filter((o) => !judgmentIds.has(o.sourceJudgmentId));
    // StatuteVersion은 Batch와 독립된 기준 데이터라 삭제하지 않는다 (docs/api.md 6장).
    this.store.uploadBatches = this.store.uploadBatches.filter((b) => b.id !== batchId);
  }
}
