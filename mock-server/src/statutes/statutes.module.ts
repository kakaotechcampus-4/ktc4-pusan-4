import { Module } from '@nestjs/common';
import { StatutesController } from './statutes.controller';
import { StatutesService } from './statutes.service';

@Module({
  controllers: [StatutesController],
  providers: [StatutesService],
})
export class StatutesModule {}
