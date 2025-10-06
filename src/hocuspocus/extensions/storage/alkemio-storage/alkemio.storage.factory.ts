import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { FactoryProvider } from '@nestjs/common';
import { Extension } from '@hocuspocus/server';
import { AlkemioStorage } from './alkemio.storage';
import { AlkemioStorageService } from './alkemio.storage.service';
import { ALKEMIO_STORAGE_EXTENSION } from './alkemio.storage.injection.token';

export const AlkemioStorageFactory: FactoryProvider<Extension> = {
  provide: ALKEMIO_STORAGE_EXTENSION,
  inject: [AlkemioStorageService, WINSTON_MODULE_NEST_PROVIDER],
  useFactory: (storageService: AlkemioStorageService, logger: WinstonLogger) => {
    return new AlkemioStorage(storageService, logger);
  },
};
