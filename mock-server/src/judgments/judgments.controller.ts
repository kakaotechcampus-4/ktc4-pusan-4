import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OverrideJudgmentDto } from './dto/override-judgment.dto';
import { JudgmentsService } from './judgments.service';

@ApiTags('judgments')
@Controller('judgments')
export class JudgmentsController {
  constructor(private readonly judgmentsService: JudgmentsService) {}

  @Get()
  list(
    @Query('transactionId') transactionId?: string,
    @Query('batchId') batchId?: string,
    @Query('year') year?: string,
    @Query('verdict') verdict?: string,
    @Query('latestOnly') latestOnly?: string,
    @Query('runId') runId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.judgmentsService.list({
      transactionId,
      batchId,
      year,
      verdict,
      runId,
      latestOnly: latestOnly === undefined ? undefined : latestOnly === 'true',
      page: page ? Number(page) : undefined,
      size: size ? Number(size) : undefined,
    });
  }

  // 'summary'는 :judgmentId보다 먼저 선언해야 한다 (안 그러면 summary가 judgmentId로 잡힌다).
  @Get('summary')
  summary(@Query('batchId') batchId?: string, @Query('year') year?: string, @Query('runId') runId?: string) {
    return this.judgmentsService.summary({ batchId, year, runId });
  }

  @Get(':judgmentId')
  detail(@Param('judgmentId') judgmentId: string) {
    return this.judgmentsService.detail(judgmentId);
  }

  @Post(':judgmentId/override')
  @HttpCode(200)
  override(@Param('judgmentId') judgmentId: string, @Body() dto: OverrideJudgmentDto) {
    return this.judgmentsService.override(judgmentId, dto.toVerdict, dto.reason);
  }
}
