import { Module } from '@nestjs/common';
import { JudgmentOverridesController } from './judgment-overrides.controller';
import { JudgmentsController } from './judgments.controller';
import { JudgmentsService } from './judgments.service';

@Module({
  controllers: [JudgmentsController, JudgmentOverridesController],
  providers: [JudgmentsService],
})
export class JudgmentsModule {}
