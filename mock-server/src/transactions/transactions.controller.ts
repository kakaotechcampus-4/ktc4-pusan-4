import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  list(
    @Query('batchId') batchId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
    @Query('classificationStatus') classificationStatus?: string,
    @Query('verdict') verdict?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.transactionsService.list({
      batchId,
      year,
      month,
      status,
      classificationStatus,
      verdict,
      page: page ? Number(page) : undefined,
      size: size ? Number(size) : undefined,
    });
  }

  @Get(':transactionId')
  detail(@Param('transactionId') transactionId: string) {
    return this.transactionsService.detail(transactionId);
  }

  @Post(':transactionId/include')
  @HttpCode(200)
  include(@Param('transactionId') transactionId: string) {
    return this.transactionsService.include(transactionId);
  }

  @Post(':transactionId/exclude')
  @HttpCode(200)
  exclude(@Param('transactionId') transactionId: string) {
    return this.transactionsService.exclude(transactionId);
  }
}
