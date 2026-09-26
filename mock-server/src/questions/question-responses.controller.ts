import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuestionResponseDto } from './dto/question-response.dto';
import { QuestionsService } from './questions.service';

@ApiTags('question-responses')
@Controller('question-responses')
export class QuestionResponsesController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  @HttpCode(200)
  respond(@Body() dto: QuestionResponseDto) {
    return this.questionsService.respond(dto.questionIds, dto.answer.value);
  }
}
