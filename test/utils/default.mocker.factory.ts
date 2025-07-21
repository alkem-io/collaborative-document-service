import { InjectionToken } from '@nestjs/common';
import { vi } from 'vitest';

/**
 * You can add already existing providers here, to be auto mocked
 */
const mockerDictionary = new Map<InjectionToken, any>();

export const defaultMockerFactory = (token: InjectionToken | undefined) => {
  if (typeof token === 'function') {
    // Mock all class methods with vi.fn()
    const methodNames = Object.getOwnPropertyNames(token.prototype).filter(
      prop =>
        prop !== 'constructor' && typeof token.prototype[prop] === 'function'
    );
    const mock: any = {};
    for (const method of methodNames) {
      mock[method] = vi.fn();
    }
    return mock;
  }

  if (typeof token === 'string') {
    const mockProvider = mockerDictionary.get(token);
    if (mockProvider) {
      return mockProvider;
    }
  }

  throw Error(
    `[Default Mocker] No provider found for token: ${JSON.stringify(token)}`
  );
};
