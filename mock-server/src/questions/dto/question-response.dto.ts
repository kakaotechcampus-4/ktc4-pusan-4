import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsString, ValidateNested } from 'class-validator';

export class AnswerDto {
  @ApiProperty({ example: '사업' })
  @IsString()
  value!: string;
}

export class QuestionResponseDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  questionIds!: string[];

  @ApiProperty({ type: AnswerDto })
  @ValidateNested()
  @Type(() => AnswerDto)
  answer!: AnswerDto;
}
