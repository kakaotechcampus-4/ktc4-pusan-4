import { Module } from '@nestjs/common';
import { UploadBatchesController } from './upload-batches.controller';
import { UploadBatchesService } from './upload-batches.service';

@Module({
  controllers: [UploadBatchesController],
  providers: [UploadBatchesService],
})
export class UploadBatchesModule {}
