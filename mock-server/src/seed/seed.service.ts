import { Injectable, OnModuleInit } from '@nestjs/common';
import { StoreService } from '../store/store.service';
import {
  SEED_CLASSIFICATION_REVIEW,
  SEED_CONTEXT,
  SEED_JUDGMENT_RUN,
  SEED_JUDGMENTS,
  SEED_QUESTIONS,
  SEED_STATUTES,
  SEED_TRANSACTIONS,
  SEED_UPLOAD_BATCH,
  SEED_USER,
} from './seed-data';

/** 서버 부팅 시 1회, 업로드 없이 바로 탐색 가능한 배치 하나를 채워둔다. */
@Injectable()
export class SeedService implements OnModuleInit {
  constructor(private readonly store: StoreService) {}

  onModuleInit() {
    this.store.users.push(SEED_USER);
    this.store.contexts.push(SEED_CONTEXT);
    this.store.uploadBatches.push(SEED_UPLOAD_BATCH);
    this.store.judgmentRuns.push(SEED_JUDGMENT_RUN);
    this.store.transactions.push(...SEED_TRANSACTIONS);
    this.store.judgments.push(...SEED_JUDGMENTS);
    this.store.classificationReviews.push(SEED_CLASSIFICATION_REVIEW);
    this.store.questions.push(...SEED_QUESTIONS);
    this.store.statutes.push(...SEED_STATUTES);
  }
}
