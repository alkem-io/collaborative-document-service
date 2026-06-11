import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { Extension } from '@hocuspocus/server';
import { AlkemioAuthenticatorModule } from './alkemio.authenticator.module';
import { AlkemioAuthenticator } from './alkemio.authenticator';
import { ALKEMIO_AUTHENTICATION_EXTENSION } from './alkemio.authentication.inject.token';

// In production, `WinstonModule.forRootAsync` makes the logger provider global.
// Mirror that for the test so the slim auth module — which doesn't import
// Winston itself — can still resolve its logger dep.
@Global()
@Module({
  providers: [{ provide: WINSTON_MODULE_NEST_PROVIDER, useValue: mock<WinstonLogger>() }],
  exports: [WINSTON_MODULE_NEST_PROVIDER],
})
class GlobalLoggerStubModule {}

/**
 * Wiring smoke test for the slimmed authenticator module. After the gateway
 * refactor the module declares only the authenticator + its factory; if a
 * future change re-introduces a constructor dependency without registering
 * the corresponding provider, Nest fails to compile this module and these
 * tests catch it before the server bootstraps.
 */
describe('AlkemioAuthenticatorModule', () => {
  let testingModule: TestingModule;

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      imports: [GlobalLoggerStubModule, AlkemioAuthenticatorModule],
    }).compile();
  });

  it('resolves the extension factory token to an AlkemioAuthenticator', () => {
    const extension = testingModule.get<Extension>(ALKEMIO_AUTHENTICATION_EXTENSION);

    expect(extension).toBeInstanceOf(AlkemioAuthenticator);
  });

  it('exposes the authenticator itself as an instantiable provider', () => {
    const authenticator = testingModule.get(AlkemioAuthenticator);

    expect(authenticator).toBeInstanceOf(AlkemioAuthenticator);
  });

  it('returns the same singleton instance for the factory token across resolutions', () => {
    const first = testingModule.get<Extension>(ALKEMIO_AUTHENTICATION_EXTENSION);
    const second = testingModule.get<Extension>(ALKEMIO_AUTHENTICATION_EXTENSION);

    expect(first).toBe(second);
  });
});
