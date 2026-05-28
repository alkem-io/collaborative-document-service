import { Extension } from '@hocuspocus/server';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { FactoryProvider } from '@nestjs/common';
import { AlkemioAuthenticator } from './alkemio.authenticator';
import { ALKEMIO_AUTHENTICATION_EXTENSION } from './alkemio.authentication.inject.token';

// Identity now comes from the gateway via X-Alkemio-Actor-Id; the
// authenticator only needs a logger.
export const AlkemioAuthenticatorFactory: FactoryProvider<Extension> = {
  provide: ALKEMIO_AUTHENTICATION_EXTENSION,
  inject: [WINSTON_MODULE_NEST_PROVIDER],
  useFactory: (logger: WinstonLogger) => {
    return new AlkemioAuthenticator(logger);
  },
};
