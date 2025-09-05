import { Module } from '@nestjs/common';
import { IntegrationModule } from '@src/services/integration';
import { NorthStartMetricService } from './north.start.metric.service';
import { NorthStarMetricFactory } from './north.star.metric.factory';
import { NorthStarMetric } from './north.star.metric.extension';

@Module({
  imports: [IntegrationModule],
  providers: [NorthStartMetricService, NorthStarMetric, NorthStarMetricFactory],
  exports: [NorthStarMetricFactory],
})
export class NorthStartMetricModule {}
