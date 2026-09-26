import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClassificationModule } from './classification/classification.module';
import { BearerAuthGuard } from './common/bearer-auth.guard';
import { JudgmentRunsModule } from './judgment-runs/judgment-runs.module';
import { JudgmentsModule } from './judgments/judgments.module';
import { QuestionsModule } from './questions/questions.module';
import { SeedModule } from './seed/seed.module';
import { StatutesModule } from './statutes/statutes.module';
import { StoreModule } from './store/store.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UploadBatchesModule } from './upload-batches/upload-batches.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    StoreModule,
    SeedModule,
    UsersModule,
    UploadBatchesModule,
    TransactionsModule,
    ClassificationModule,
    JudgmentRunsModule,
    JudgmentsModule,
    QuestionsModule,
    StatutesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: BearerAuthGuard }],
})
export class AppModule {}
