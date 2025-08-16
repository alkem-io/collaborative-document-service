import { Module } from '@nestjs/common';
import { UtilModule } from '@src/services/util';
import { HocuspocusConnectionService } from '@src/hocuspocus/services';
import { AlkemioAuthenticationService } from './alkemio.authentication.service';
import { AlkemioAuthenticator } from './alkemio.authenticator';
import { AlkemioAuthenticatorFactory } from './alkemio.authenticator.factory';

@Module({
  imports: [UtilModule],
  providers: [
    AlkemioAuthenticationService,
    HocuspocusConnectionService,
    AlkemioAuthenticator,
    AlkemioAuthenticatorFactory,
  ],
  exports: [AlkemioAuthenticatorFactory],
})
export class AlkemioAuthenticatorModule {}
