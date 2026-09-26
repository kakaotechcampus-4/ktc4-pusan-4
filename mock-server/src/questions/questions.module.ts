import { Module } from '@nestjs/common';
import { QuestionResponsesController } from './question-responses.controller';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Module({
  controllers: [QuestionsController, QuestionResponsesController],
  providers: [QuestionsService],
})
export class QuestionsModule {}
