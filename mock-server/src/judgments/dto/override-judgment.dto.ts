import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import type { Verdict } from '../../common/coded';

const VERDICTS: Verdict[] = ['AVAILABLE', 'UNAVAILABLE', 'NEEDS_REVIEW'];

export class OverrideJudgmentDto {
  @ApiProperty({ enum: VERDICTS })
  @IsIn(VERDICTS)
  toVerdict!: Verdict;

  @ApiProperty()
  @IsString()
  reason!: string;
}
