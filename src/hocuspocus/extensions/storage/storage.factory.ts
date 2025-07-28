import { Extension, onLoadDocumentPayload, onStoreDocumentPayload } from '@hocuspocus/server';
import { FactoryProvider } from '@nestjs/common';
import * as Y from 'yjs';
import { UtilService } from '@src/services/util/util.service';

const storage = new Map<string, Y.Doc>();

const StorageFactory: FactoryProvider<Extension> = {
  provide: '',
  inject: [UtilService],
  useFactory: () => {
    return new (class Storage implements Extension {
      /**
       * Called once, when the first client connects to the server, during the creation of a new document.
       * Called after onAuthenticate
       * @param data
       */
      onLoadDocument(data: onLoadDocumentPayload): Promise<any> {
        return Promise.resolve(storage.get(data.documentName) ?? new Y.Doc());
      }
      /**
       * The onStoreDocument hooks are called after the document has been changed (after the onChange hook)
       * Calls to onStoreDocument are debounced by default (see debounce and maxDebounce configuration options).
       */
      onStoreDocument(data: onStoreDocumentPayload): Promise<any> {
        storage.set(data.documentName, data.document);
        return Promise.resolve();
      }
    })();
  },
};
export default StorageFactory;
