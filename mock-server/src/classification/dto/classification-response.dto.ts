import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ClassificationResponseDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  reviewIds!: string[];

  @ApiProperty({ example: '해외SaaS' })
  @IsString()
  merchantCategory!: string;
}
