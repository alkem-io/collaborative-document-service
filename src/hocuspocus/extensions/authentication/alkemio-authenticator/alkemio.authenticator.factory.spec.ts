import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { AlkemioAuthenticatorFactory } from './alkemio.authenticator.factory';
import { AlkemioAuthenticator } from './alkemio.authenticator';
import { ALKEMIO_AUTHENTICATION_EXTENSION } from './alkemio.authentication.inject.token';

/**
 * The factory is the DI contract between the hocuspocus module and the
 * authenticator: it pins the token clients look up, the dependencies Nest
 * is asked to inject, and the constructor shape. If any of these drift,
 * extension registration silently breaks at runtime.
 */
describe('AlkemioAuthenticatorFactory', () => {
  it('registers under ALKEMIO_AUTHENTICATION_EXTENSION', () => {
    expect(AlkemioAuthenticatorFactory.provide).toBe(ALKEMIO_AUTHENTICATION_EXTENSION);
  });

  it('injects only the Winston logger (no other deps after the gateway refactor)', () => {
    expect(AlkemioAuthenticatorFactory.inject).toEqual([WINSTON_MODULE_NEST_PROVIDER]);
  });

  it('constructs an AlkemioAuthenticator from the injected logger', () => {
    const logger = mock<WinstonLogger>();

    const useFactory = AlkemioAuthenticatorFactory.useFactory as (
      logger: WinstonLogger
    ) => AlkemioAuthenticator;
    const instance = useFactory(logger);

    expect(instance).toBeInstanceOf(AlkemioAuthenticator);
  });

  it('produces an instance carrying the AlkemioAuthenticator extension name', () => {
    const logger = mock<WinstonLogger>();

    const useFactory = AlkemioAuthenticatorFactory.useFactory as (
      logger: WinstonLogger
    ) => AlkemioAuthenticator;
    const instance = useFactory(logger);

    // AbstractAuthenticator exposes `extensionName` — Hocuspocus uses this when
    // logging which extension handled a hook. Pin it so future refactors of
    // the base class don't silently drop the identifier.
    expect(instance.extensionName).toBe('AlkemioAuthenticator');
  });
});
