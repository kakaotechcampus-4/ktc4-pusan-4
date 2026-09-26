import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClassificationResponseDto } from './dto/classification-response.dto';
import { ClassificationService } from './classification.service';

@ApiTags('classification-responses')
@Controller('classification-responses')
export class ClassificationResponsesController {
  constructor(private readonly classificationService: ClassificationService) {}

  @Post()
  @HttpCode(200)
  respond(@Body() dto: ClassificationResponseDto) {
    return this.classificationService.respond(dto.reviewIds, dto.merchantCategory);
  }
}
