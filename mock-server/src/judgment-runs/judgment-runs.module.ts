import { Module } from '@nestjs/common';
import { JudgmentRunsController } from './judgment-runs.controller';
import { JudgmentRunsService } from './judgment-runs.service';

@Module({
  controllers: [JudgmentRunsController],
  providers: [JudgmentRunsService],
})
export class JudgmentRunsModule {}
