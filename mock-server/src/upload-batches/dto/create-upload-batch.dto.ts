import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class TransactionInputDto {
  @ApiProperty({ example: '2026-01-03' })
  @IsDateString()
  approvedAt!: string;

  @ApiProperty()
  @IsString()
  merchantRaw!: string;

  @ApiProperty()
  @IsInt()
  amount!: number;

  /** 문서상 필수지만, 누락 시 422 MISSING_NATURAL_KEY를 서비스에서 직접 던지기 위해 검증을 느슨하게 둔다. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  naturalKey?: string;

  @ApiProperty({ enum: ['JUDGEABLE', 'CANCELED_OFFSET', 'EXCLUDED'] })
  @IsIn(['JUDGEABLE', 'CANCELED_OFFSET', 'EXCLUDED'])
  status!: 'JUDGEABLE' | 'CANCELED_OFFSET' | 'EXCLUDED';

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  installmentMonths?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  approvalNo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bizNo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  branchRaw?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  memo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isAggregated?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  needsReview?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reviewReason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sourceCard?: string;
}

export class CreateUploadBatchDto {
  /** '승인내역'만 허용된다. 다른 값은 서비스에서 422 INVALID_SOURCE_TYPE으로 직접 처리한다. */
  @ApiProperty({ example: '승인내역' })
  @IsString()
  sourceType!: string;

  @ApiProperty({ enum: ['국민', '기업'] })
  @IsIn(['국민', '기업'])
  cardIssuer!: '국민' | '기업';

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ example: '2026-01-31' })
  @IsDateString()
  periodEnd!: string;

  @ApiProperty()
  @IsString()
  fileHash!: string;

  @ApiProperty({ type: [TransactionInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionInputDto)
  transactions!: TransactionInputDto[];
}
