import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateJudgmentRunDto } from './dto/create-judgment-run.dto';
import { JudgmentRunsService } from './judgment-runs.service';

@ApiTags('judgment-runs')
@Controller('judgment-runs')
export class JudgmentRunsController {
  constructor(private readonly judgmentRunsService: JudgmentRunsService) {}

  @Post()
  @HttpCode(202)
  create(@Body() dto: CreateJudgmentRunDto) {
    return this.judgmentRunsService.create(dto.batchId, dto.contextId);
  }

  @Get(':runId')
  get(@Param('runId') runId: string) {
    return this.judgmentRunsService.get(runId);
  }

  @Get(':runId/failures')
  failures(@Param('runId') runId: string, @Query('page') page?: string, @Query('size') size?: string) {
    return this.judgmentRunsService.failures(runId, page ? Number(page) : undefined, size ? Number(size) : undefined);
  }
}
