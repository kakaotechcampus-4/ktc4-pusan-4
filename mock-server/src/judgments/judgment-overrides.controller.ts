import { Controller, Delete, HttpCode, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JudgmentsService } from './judgments.service';

@ApiTags('judgment-overrides')
@Controller('judgment-overrides')
export class JudgmentOverridesController {
  constructor(private readonly judgmentsService: JudgmentsService) {}

  @Delete(':overrideId')
  @HttpCode(204)
  release(@Param('overrideId') overrideId: string) {
    this.judgmentsService.releaseOverride(overrideId);
  }
}
