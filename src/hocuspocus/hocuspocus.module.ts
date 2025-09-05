import { Module } from '@nestjs/common';
import { HocuspocusServer } from './hocuspocus.server';
import { AuthenticationModule } from '@src/hocuspocus/extensions/authentication/authentication.module';
import { StorageModule } from '@src/hocuspocus/extensions/storage/storage.module';
import { NorthStartMetricModule } from '@src/hocuspocus/extensions/north-star-metric';

@Module({
  imports: [AuthenticationModule, StorageModule, NorthStartMetricModule],
  providers: [HocuspocusServer],
  exports: [HocuspocusServer],
})
export class HocuspocusModule {}
