import { Extension } from '@hocuspocus/server';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigType } from '@src/config';
import { NORTH_STAR_METRIC_EXTENSION } from './north.star.metric.injection.token';
import { NorthStarMetric } from './north.star.metric.extension';
import { NorthStarMetricService } from './north.star.metric.service';

export const NorthStarMetricFactory: FactoryProvider<Extension> = {
  provide: NORTH_STAR_METRIC_EXTENSION,
  inject: [WINSTON_MODULE_NEST_PROVIDER, ConfigService, NorthStarMetricService],
  useFactory: (
    logger: WinstonLogger,
    configService: ConfigService<ConfigType, true>,
    northStarMetricService: NorthStarMetricService
  ) => {
    return new NorthStarMetric(logger, configService, northStarMetricService);
  },
};
