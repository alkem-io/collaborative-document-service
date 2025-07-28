import { Module } from '@nestjs/common';
import { IntegrationService } from '@src/services/integration';
import { HealthController } from './health.controller';

@Module({
  imports: [IntegrationService],
  controllers: [HealthController],
})
export class HealthModule {}
