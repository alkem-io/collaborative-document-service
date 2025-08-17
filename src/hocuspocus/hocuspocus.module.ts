import { Module } from '@nestjs/common';
import { AlkemioStorageModule } from './extensions/storage/alkemio-storage';
import { AlkemioAuthenticatorModule } from './extensions/authentication/alkemio-authenticator';
import { AlkemioAuthorizerModule } from './extensions/authorization/alkemio-authorizer';
import { HocuspocusServer } from './hocuspocus.server';

@Module({
  imports: [AlkemioAuthenticatorModule, AlkemioAuthorizerModule, AlkemioStorageModule],
  providers: [HocuspocusServer],
  exports: [HocuspocusServer],
})
export class HocuspocusModule {}
