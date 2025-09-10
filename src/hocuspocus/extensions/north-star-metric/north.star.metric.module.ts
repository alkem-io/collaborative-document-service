import { Module } from '@nestjs/common';
import { IntegrationModule } from '@src/services/integration';
import { NorthStarMetricService } from './north.star.metric.service';
import { NorthStarMetricFactory } from './north.star.metric.factory';
import { NorthStarMetric } from './north.star.metric.extension';

@Module({
  imports: [IntegrationModule],
  providers: [NorthStarMetricService, NorthStarMetric, NorthStarMetricFactory],
  exports: [NorthStarMetricFactory],
})
export class NorthStarMetricModule {}
