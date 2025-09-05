import { Extension } from '@hocuspocus/server';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigType } from '@src/config';
import { NORTH_START_METRIC_EXTENSION } from './north.star.metric.injection.token';
import { NorthStarMetric } from './north.star.metric.extension';

export const NorthStarMetricFactory: FactoryProvider<Extension> = {
  provide: NORTH_START_METRIC_EXTENSION,
  inject: [WINSTON_MODULE_NEST_PROVIDER, ConfigService],
  useFactory: (logger: WinstonLogger, configService: ConfigService<ConfigType, true>) => {
    return new NorthStarMetric(logger, configService);
  },
};
