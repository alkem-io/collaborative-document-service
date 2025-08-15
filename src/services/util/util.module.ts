import { Module } from '@nestjs/common';
import { IntegrationModule } from '@src/services/integration';
import { UtilService } from './util.service';

@Module({
  imports: [IntegrationModule],
  providers: [UtilService],
  exports: [UtilService],
})
export class UtilModule {}
