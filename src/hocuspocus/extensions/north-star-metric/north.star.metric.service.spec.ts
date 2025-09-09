import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { NorthStarMetricService } from './north.star.metric.service';

describe('NorthStartMetricService', () => {
  let service: NorthStarMetricService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NorthStarMetricService],
    }).compile();

    service = module.get<NorthStarMetricService>(NorthStarMetricService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
