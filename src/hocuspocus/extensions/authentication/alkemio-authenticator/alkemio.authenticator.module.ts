import { Module } from '@nestjs/common';
import { AlkemioAuthenticator } from './alkemio.authenticator';
import { AlkemioAuthenticatorFactory } from './alkemio.authenticator.factory';

@Module({
  providers: [AlkemioAuthenticator, AlkemioAuthenticatorFactory],
  exports: [AlkemioAuthenticatorFactory],
})
export class AlkemioAuthenticatorModule {}
