import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { NorthStartMetricService } from './north.start.metric.service';

describe('NorthStartMetricService', () => {
  let service: NorthStartMetricService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NorthStartMetricService],
    }).compile();

    service = module.get<NorthStartMetricService>(NorthStartMetricService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
