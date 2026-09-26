import { Module } from '@nestjs/common';
import { ClassificationReviewsController } from './classification-reviews.controller';
import { ClassificationResponsesController } from './classification-responses.controller';
import { ClassificationService } from './classification.service';

@Module({
  controllers: [ClassificationReviewsController, ClassificationResponsesController],
  providers: [ClassificationService],
})
export class ClassificationModule {}
