import { Doc } from 'yjs';
import { Extension, onLoadDocumentPayload, onStoreDocumentPayload } from '@hocuspocus/server';
import { FactoryProvider } from '@nestjs/common';
import { UtilService } from '@src/services/util';
import { STORAGE_EXTENSION } from './storage.extension.token';
import { AbstractStorage } from './abstract.storage';
import { isSaveErrorData } from '@src/services/integration/outputs';

const StorageFactory: FactoryProvider<Extension> = {
  provide: STORAGE_EXTENSION,
  inject: [UtilService],
  useFactory: (utilService: UtilService) => {
    return new (class Storage extends AbstractStorage {
      /**
       * Called once, when the first client connects to the server, during the creation of a new document.
       * Called after onAuthenticate
       * @param data
       */
      onLoadDocument({ documentName: documentId }: onLoadDocumentPayload): Promise<Doc> {
        return utilService.fetchMemo(documentId);
      }
      /**
       * The onStoreDocument hooks are called after the document has been changed (after the onChange hook)
       * Calls to onStoreDocument are debounced by default (see debounce and maxDebounce configuration options).
       */
      async onStoreDocument(a: onStoreDocumentPayload): Promise<any> {
        const { documentName: documentId, document } = a;
        const result = await utilService.save(documentId, document);

        if (isSaveErrorData(result.data)) {
          document.broadcastStateless('save-error');
        } else {
          document.broadcastStateless('saved');
        }

        return Promise.resolve();
      }
    })();
  },
};
export default StorageFactory;
