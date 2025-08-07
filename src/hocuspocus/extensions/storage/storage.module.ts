import { Module } from '@nestjs/common';
import { UtilModule } from '@src/services/util';
import StorageFactory from './storage.factory';

@Module({
  imports: [UtilModule],
  providers: [StorageFactory],
  exports: [StorageFactory],
})
export class StorageModule {}
