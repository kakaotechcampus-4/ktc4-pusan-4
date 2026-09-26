import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateJudgmentRunDto {
  @ApiProperty()
  @IsString()
  batchId!: string;

  @ApiProperty()
  @IsString()
  contextId!: string;
}
