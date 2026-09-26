import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BulkAnswerDto } from './dto/bulk-answer.dto';
import { QuestionsService } from './questions.service';

@ApiTags('questions')
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post('bulk-answer')
  @HttpCode(200)
  bulkAnswer(@Body() dto: BulkAnswerDto) {
    return this.questionsService.bulkAnswer(dto.batchId, dto.factType, dto.answer.value);
  }

  @Get()
  list(
    @Query('batchId') batchId?: string,
    @Query('transactionId') transactionId?: string,
    @Query('status') status?: string,
    @Query('grouped') grouped?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.questionsService.list({
      batchId,
      transactionId,
      status,
      grouped: grouped === 'true',
      page: page ? Number(page) : undefined,
      size: size ? Number(size) : undefined,
    });
  }
}
