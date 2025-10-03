import { vi } from 'vitest';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { InjectionToken, ValueProvider } from '@nestjs/common';
import { MockWinstonProvider } from '@test/mocks';

/**
 * You can add already existing providers here, to be auto mocked
 */
const mockerDictionary = new Map<InjectionToken, ValueProvider<unknown>>([
  [WINSTON_MODULE_NEST_PROVIDER, MockWinstonProvider],
]);
/**
 * Use when you don't want a specific mock for your test.
 * A default mocker factory for NestJS testing module. It auto mocks all class methods with vi.fn().
 * It will mock class methods with vi.fn() and look for existing providers in the mockerDictionary.
 * @param token
 */
export const defaultMockerFactory = (token: InjectionToken | undefined) => {
  if (typeof token === 'function') {
    // Mock all class methods with vi.fn()
    const methodNames = Object.getOwnPropertyNames(token.prototype).filter(
      prop => prop !== 'constructor' && typeof token.prototype[prop] === 'function'
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
      return mockProvider.useValue;
    }
  }

  throw Error(`[Default Mocker] No provider found for token: ${JSON.stringify(token)}`);
};
