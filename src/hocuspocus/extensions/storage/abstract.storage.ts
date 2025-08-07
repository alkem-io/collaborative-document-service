import { Extension, onLoadDocumentPayload, onStoreDocumentPayload } from '@hocuspocus/server';

export abstract class AbstractStorage implements Extension {
  /**
   * Called once, when the first client connects to the server, during the creation of a new document.
   * Called after onAuthenticate
   */
  public abstract onLoadDocument(payload: onLoadDocumentPayload): Promise<any>;
  /**
   * The onStoreDocument hooks are called after the document has been changed (after the onChange hook)
   * Calls to onStoreDocument are debounced by default (see debounce and maxDebounce configuration options).
   */
  public abstract onStoreDocument(payload: onStoreDocumentPayload): Promise<any>;
}
