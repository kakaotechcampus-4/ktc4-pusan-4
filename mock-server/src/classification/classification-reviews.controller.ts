import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClassificationService } from './classification.service';

@ApiTags('classification-reviews')
@Controller('classification-reviews')
export class ClassificationReviewsController {
  constructor(private readonly classificationService: ClassificationService) {}

  @Get()
  list(
    @Query('batchId') batchId?: string,
    @Query('status') status?: string,
    @Query('grouped') grouped?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.classificationService.listReviews({
      batchId,
      status,
      grouped: grouped === 'true',
      page: page ? Number(page) : undefined,
      size: size ? Number(size) : undefined,
    });
  }
}
