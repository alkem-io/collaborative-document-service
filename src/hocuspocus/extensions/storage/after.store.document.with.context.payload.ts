import { afterStoreDocumentPayload } from '@hocuspocus/server';

export interface afterStoreDocumentWithContextPayload extends afterStoreDocumentPayload {
  context: {
    saved: boolean;
    error?: string;
  };
}
