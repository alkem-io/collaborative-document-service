import { Module } from '@nestjs/common';
import { IntegrationService } from './integration.service';
import { SenderService } from './sender.service';

@Module({
  providers: [IntegrationService, SenderService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
