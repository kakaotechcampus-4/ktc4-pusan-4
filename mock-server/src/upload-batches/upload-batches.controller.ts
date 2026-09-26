import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CreateUploadBatchDto } from './dto/create-upload-batch.dto';
import { UploadBatchesService } from './upload-batches.service';

@ApiTags('upload-batches')
@Controller('upload-batches')
export class UploadBatchesController {
  constructor(private readonly uploadBatchesService: UploadBatchesService) {}

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(@Body() dto: CreateUploadBatchDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.uploadBatchesService.create(dto, idempotencyKey);
  }

  @Get()
  list(@Query('page') page?: string, @Query('size') size?: string) {
    return this.uploadBatchesService.list(page ? Number(page) : undefined, size ? Number(size) : undefined);
  }

  @Get(':batchId')
  detail(@Param('batchId') batchId: string) {
    return this.uploadBatchesService.detail(batchId);
  }

  @Delete(':batchId')
  @HttpCode(204)
  remove(@Param('batchId') batchId: string) {
    this.uploadBatchesService.remove(batchId);
  }
}
