import { Module } from '@nestjs/common';
import { IntegrationModule } from '../integration';
import { HealthController } from './health.controller';

@Module({
  imports: [IntegrationModule],
  controllers: [HealthController],
})
export class HealthModule {}
