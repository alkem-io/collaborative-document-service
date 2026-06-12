import { Module } from '@nestjs/common';
import { HocuspocusConnectionService } from '@src/hocuspocus/services';
import { UtilModule } from '@src/services/util';
import { AlkemioAuthorizer } from './alkemio.authorizer';
import { AlkemioAuthorizationService } from './alkemio.authorization.service';
import { AlkemioAuthorizerFactory } from './alkemio.authorizer.factory';

@Module({
  imports: [UtilModule],
  providers: [
    HocuspocusConnectionService,
    AlkemioAuthorizationService,
    AlkemioAuthorizer,
    AlkemioAuthorizerFactory,
  ],
  exports: [AlkemioAuthorizationService, AlkemioAuthorizer, AlkemioAuthorizerFactory],
})
export class AlkemioAuthorizerModule {}
