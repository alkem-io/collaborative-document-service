import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { FactoryProvider } from '@nestjs/common';
import { HocuspocusConnectionService } from '@src/hocuspocus/services';
import { AbstractAuthorizer } from '@src/hocuspocus/extensions/authorization';
import { AlkemioAuthorizer } from './alkemio.authorizer';
import { ALKEMIO_AUTHORIZATION_EXTENSION } from './alkemio.authorization.injection.token';
import { AlkemioAuthorizationService } from './alkemio.authorization.service';

export const AlkemioAuthorizerFactory: FactoryProvider<AbstractAuthorizer> = {
  provide: ALKEMIO_AUTHORIZATION_EXTENSION,
  inject: [AlkemioAuthorizationService, HocuspocusConnectionService, WINSTON_MODULE_NEST_PROVIDER],
  useFactory: (
    authorizationService: AlkemioAuthorizationService,
    connectionService: HocuspocusConnectionService,
    logger: WinstonLogger
  ) => {
    return new AlkemioAuthorizer(authorizationService, connectionService, logger);
  },
};
