import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';
import { AnswerDto } from './question-response.dto';

export class BulkAnswerDto {
  @ApiProperty({ example: '0199c8f2-1a2b-7c3d-8e4f-5a6b7c8d9e0f' })
  @IsString()
  batchId!: string;

  @ApiProperty({ example: '용도' })
  @IsString()
  factType!: string;

  @ApiProperty({ type: AnswerDto })
  @ValidateNested()
  @Type(() => AnswerDto)
  answer!: AnswerDto;
}
