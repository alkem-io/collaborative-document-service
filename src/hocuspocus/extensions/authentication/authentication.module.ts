import { Module } from '@nestjs/common';
import { UtilModule } from '@src/services/util';
import { HocuspocusConnectionService } from '@src/hocuspocus/services';
import {
  AuthorizationService,
  AlkemioAuthenticator,
  AuthenticationService,
  AlkemioAuthenticatorFactory,
} from './alkemio-authenticator';

@Module({
  imports: [UtilModule],
  providers: [
    AuthenticationService,
    AuthorizationService,
    HocuspocusConnectionService,
    AlkemioAuthenticator,
    AlkemioAuthenticatorFactory,
  ],
  exports: [AlkemioAuthenticatorFactory],
})
export class AuthenticationModule {}
