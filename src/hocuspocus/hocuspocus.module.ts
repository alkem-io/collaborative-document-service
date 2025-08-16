import { Module } from '@nestjs/common';
import { StorageModule } from '@src/hocuspocus/extensions/storage/storage.module';
import { AlkemioAuthenticatorModule } from '@src/hocuspocus/extensions/authentication/alkemio-authenticator';
import { AlkemioAuthorizerModule } from '@src/hocuspocus/extensions/authorization/alkemio-authorizer';
import { HocuspocusServer } from './hocuspocus.server';

@Module({
  imports: [AlkemioAuthenticatorModule, AlkemioAuthorizerModule, StorageModule],
  providers: [HocuspocusServer],
  exports: [HocuspocusServer],
})
export class HocuspocusModule {}
