import { Extension } from '@hocuspocus/server';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { FactoryProvider } from '@nestjs/common';
import { AlkemioAuthenticator } from './alkemio.authenticator';
import { ALKEMIO_AUTHENTICATION_EXTENSION } from './alkemio.authentication.inject.token';
import { AlkemioAuthenticationService } from './alkemio.authentication.service';

export const AlkemioAuthenticatorFactory: FactoryProvider<Extension> = {
  provide: ALKEMIO_AUTHENTICATION_EXTENSION,
  inject: [AlkemioAuthenticationService, WINSTON_MODULE_NEST_PROVIDER],
  useFactory: (authenticationService: AlkemioAuthenticationService, logger: WinstonLogger) => {
    return new AlkemioAuthenticator(authenticationService, logger);
  },
};
