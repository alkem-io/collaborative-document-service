import { vi } from 'vitest';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { MockValueProvider } from "@test/utils";

export const MockWinstonProvider: MockValueProvider<WinstonLogger> = {
  provide: WINSTON_MODULE_NEST_PROVIDER,
  useValue: {
    debug: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    verbose: vi.fn(),
  },
};
