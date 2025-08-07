import { Module } from '@nestjs/common';
import { HocuspocusServer } from './hocuspocus.server';
import { AuthenticationModule } from '@src/hocuspocus/extensions/authentication/authentication.module';
import { StorageModule } from '@src/hocuspocus/extensions/storage/storage.module';

@Module({
  imports: [AuthenticationModule, StorageModule],
  providers: [HocuspocusServer],
  exports: [HocuspocusServer],
})
export class HocuspocusModule {}
