import { Module } from '@nestjs/common';
import { UtilModule } from '@src/services/util';
import { AlkemioStorageService } from './alkemio.storage.service';
import { AlkemioStorageFactory } from './alkemio.storage.factory';

@Module({
  imports: [UtilModule],
  providers: [AlkemioStorageService, AlkemioStorageFactory],
  exports: [AlkemioStorageFactory],
})
export class AlkemioStorageModule {}
