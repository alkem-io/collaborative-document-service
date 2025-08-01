import { Doc } from 'yjs';
import { onLoadDocumentPayload, onStoreDocumentPayload } from '@hocuspocus/server';
import { AbstractStorage } from '../abstract.storage';

const inMemoryStorage = new Map<string, Doc>();

class InMemoryStorage extends AbstractStorage {
  /**
   * Called once, when the first client connects to the server, during the creation of a new document.
   * Called after onAuthenticate
   * @param data
   */
  onLoadDocument({ documentName: documentId }: onLoadDocumentPayload): Promise<Doc> {
    return Promise.resolve(inMemoryStorage.get(documentId) ?? new Doc());
  }
  /**
   * The onStoreDocument hooks are called after the document has been changed (after the onChange hook)
   * Calls to onStoreDocument are debounced by default (see debounce and maxDebounce configuration options).
   */
  onStoreDocument({ documentName: documentId, document }: onStoreDocumentPayload): Promise<any> {
    inMemoryStorage.set(documentId, document);
    return Promise.resolve();
  }
}
export default InMemoryStorage;
