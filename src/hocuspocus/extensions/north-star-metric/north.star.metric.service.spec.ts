import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { NorthStarMetricService } from './north.star.metric.service';
import { defaultMockerFactory } from '@test/utils';

describe('NorthStarMetricService', () => {
  let service: NorthStarMetricService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NorthStarMetricService],
    })
      .useMocker(defaultMockerFactory)
      .compile();

    service = module.get<NorthStarMetricService>(NorthStarMetricService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
