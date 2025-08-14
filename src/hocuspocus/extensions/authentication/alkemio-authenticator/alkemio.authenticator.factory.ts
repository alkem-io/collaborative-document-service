import { Extension } from '@hocuspocus/server';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { FactoryProvider } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { AuthorizationService } from './authorization.service';
import { HocuspocusConnectionService } from '@src/hocuspocus/services';
import { AlkemioAuthenticator } from './alkemio.authenticator';
import { AUTHENTICATION_EXTENSION } from '../authentication.extension.token';

export const AlkemioAuthenticatorFactory: FactoryProvider<Extension> = {
  provide: AUTHENTICATION_EXTENSION,
  inject: [
    AuthenticationService,
    AuthorizationService,
    HocuspocusConnectionService,
    WINSTON_MODULE_NEST_PROVIDER,
  ],
  useFactory: (
    authenticationService: AuthenticationService,
    authorizationService: AuthorizationService,
    connectionService: HocuspocusConnectionService,
    logger: WinstonLogger
  ) => {
    return new AlkemioAuthenticator(
      authenticationService,
      authorizationService,
      connectionService,
      logger
    );
  },
};
