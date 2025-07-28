import { Module } from '@nestjs/common';
import { UtilModule } from '@src/services/util';
import AuthenticationFactory from './authentication.factory';

@Module({
  imports: [UtilModule],
  providers: [AuthenticationFactory],
  exports: [AuthenticationFactory],
})
export class AuthenticationModule {}
