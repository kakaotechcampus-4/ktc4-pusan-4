import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { BookkeepingDuty } from '../../store/entities';

const BOOKKEEPING_DUTIES: BookkeepingDuty[] = ['복식부기', '간편장부', '추계'];

export class CreateContextDto {
  @ApiProperty({ maxLength: 6 })
  @IsString()
  @MaxLength(6)
  industryCode!: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  prevYearRevenue!: number;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  businessOpenDate!: string;

  @ApiProperty({ enum: BOOKKEEPING_DUTIES })
  @IsIn(BOOKKEEPING_DUTIES)
  bookkeepingDuty!: BookkeepingDuty;

  @ApiProperty()
  @IsBoolean()
  hasEmployee!: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  homeOfficeRatio?: number;
}
