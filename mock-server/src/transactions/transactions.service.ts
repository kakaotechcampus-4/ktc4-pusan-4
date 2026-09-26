import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { CLASSIFICATION_STATUS_LABELS, SOURCE_STATUS_LABELS, coded, computeEffectiveStatus } from '../common/coded';
import { paginate } from '../common/pagination';
import { TransactionEntity } from '../store/entities';
import { StoreService } from '../store/store.service';

export interface TransactionListQuery {
  batchId?: string;
  year?: string;
  month?: string;
  status?: string;
  classificationStatus?: string;
  verdict?: string;
  page?: number;
  size?: number;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly store: StoreService) {}

  private toResponse(tx: TransactionEntity) {
    const effectiveStatus = computeEffectiveStatus(tx.sourceStatus, tx.userInclusion);
    return {
      id: tx.id,
      batchId: tx.batchId,
      approvedAt: tx.approvedAt,
      merchantRaw: tx.merchantRaw,
      merchantNorm: tx.merchantNorm,
      merchantCategory: tx.merchantCategory,
      classificationStatus: coded(tx.classificationStatus, CLASSIFICATION_STATUS_LABELS),
      amount: tx.amount,
      installmentMonths: tx.installmentMonths,
      sourceStatus: coded(tx.sourceStatus, SOURCE_STATUS_LABELS),
      userInclusion: tx.userInclusion,
      effectiveStatus: coded(effectiveStatus, SOURCE_STATUS_LABELS),
    };
  }

  private findOrThrow(transactionId: string): TransactionEntity {
    const tx = this.store.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new ApiError(404, 'TRANSACTION_NOT_FOUND', '요청한 거래를 찾을 수 없습니다.');
    return tx;
  }

  list(query: TransactionListQuery) {
    let items = [...this.store.transactions];
    if (query.batchId) items = items.filter((t) => t.batchId === query.batchId);
    if (query.year) items = items.filter((t) => t.approvedAt.startsWith(query.year!));
    if (query.month) {
      const mm = query.month!.padStart(2, '0');
      items = items.filter((t) => t.approvedAt.slice(5, 7) === mm);
    }
    if (query.status) {
      items = items.filter((t) => computeEffectiveStatus(t.sourceStatus, t.userInclusion) === query.status);
    }
    if (query.classificationStatus) {
      items = items.filter((t) => t.classificationStatus === query.classificationStatus);
    }
    if (query.verdict) {
      items = items.filter((t) => this.store.currentJudgment(t.id)?.verdict === query.verdict);
    }

    items.sort((a, b) => {
      if (a.approvedAt !== b.approvedAt) return a.approvedAt < b.approvedAt ? 1 : -1;
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    });

    const page = paginate(items, query.page, query.size);
    return { items: page.items.map((t) => this.toResponse(t)), page: page.page };
  }

  detail(transactionId: string) {
    return this.toResponse(this.findOrThrow(transactionId));
  }

  exclude(transactionId: string) {
    const tx = this.findOrThrow(transactionId);
    tx.userInclusion = 'EXCLUDED';
    const effectiveStatus = computeEffectiveStatus(tx.sourceStatus, tx.userInclusion);
    return { id: tx.id, userInclusion: tx.userInclusion, effectiveStatus: coded(effectiveStatus, SOURCE_STATUS_LABELS) };
  }

  include(transactionId: string) {
    const tx = this.findOrThrow(transactionId);
    if (tx.sourceStatus === 'CANCELED_OFFSET') {
      throw new ApiError(409, 'CANCELED_TRANSACTION_NOT_INCLUDABLE', '취소상계된 거래는 판정 대상에 포함할 수 없습니다.');
    }
    tx.userInclusion = 'INCLUDED';
    const effectiveStatus = computeEffectiveStatus(tx.sourceStatus, tx.userInclusion);
    return { id: tx.id, userInclusion: tx.userInclusion, effectiveStatus: coded(effectiveStatus, SOURCE_STATUS_LABELS) };
  }
}
