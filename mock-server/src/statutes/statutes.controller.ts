import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StatutesService } from './statutes.service';

@ApiTags('statutes')
@Controller('statutes')
export class StatutesController {
  constructor(private readonly statutesService: StatutesService) {}

  @Get(':statuteVersionId')
  detail(@Param('statuteVersionId', ParseIntPipe) statuteVersionId: number) {
    return this.statutesService.detail(statuteVersionId);
  }
}
