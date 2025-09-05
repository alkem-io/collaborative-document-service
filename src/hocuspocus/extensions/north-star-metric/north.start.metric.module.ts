import { Module } from '@nestjs/common';
import { NorthStartMetricService } from './north.start.metric.service';
import { NorthStarMetricFactory } from './north.star.metric.factory';
import { NorthStarMetric } from './north.star.metric.extension';

@Module({
  imports: [],
  providers: [NorthStartMetricService, NorthStarMetric, NorthStarMetricFactory],
  exports: [NorthStarMetricFactory],
})
export class NorthStartMetricModule {}
