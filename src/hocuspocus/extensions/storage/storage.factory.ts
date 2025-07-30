import { Doc } from 'yjs';
import { Extension, onLoadDocumentPayload, onStoreDocumentPayload } from '@hocuspocus/server';
import { FactoryProvider } from '@nestjs/common';
import { UtilService } from '@src/services/util';
import { STORAGE_EXTENSION } from './storage.extension.token';
import { AbstractStorage } from './abstract.storage';

const inMemoryStorage = new Map<string, Doc>();

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
        return Promise.resolve(inMemoryStorage.get(documentId) ?? new Doc());
        // return utilService.fetchMemo(documentId);
      }
      /**
       * The onStoreDocument hooks are called after the document has been changed (after the onChange hook)
       * Calls to onStoreDocument are debounced by default (see debounce and maxDebounce configuration options).
       */
      onStoreDocument({
        documentName: documentId,
        document,
      }: onStoreDocumentPayload): Promise<any> {
        inMemoryStorage.set(documentId, document);
        return Promise.resolve();
        // return utilService.save(documentId, document);
      }
    })();
  },
};
export default StorageFactory;
