import { Module } from '@nestjs/common';
import { AlkemioStorageModule } from './extensions/storage/alkemio-storage';
import { AlkemioAuthenticatorModule } from './extensions/authentication/alkemio-authenticator';
import { AlkemioAuthorizerModule } from './extensions/authorization/alkemio-authorizer';
import { HocuspocusServer } from './hocuspocus.server';
import { NorthStarMetricModule } from '@src/hocuspocus/extensions/north-star-metric';

@Module({
  imports: [
    AlkemioAuthenticatorModule,
    AlkemioAuthorizerModule,
    AlkemioStorageModule,
    NorthStarMetricModule,
  ],
  providers: [HocuspocusServer],
  exports: [HocuspocusServer],
})
export class HocuspocusModule {}
