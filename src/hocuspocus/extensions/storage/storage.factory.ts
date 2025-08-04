import { Doc } from 'yjs';
import { WinstonLogger } from 'nest-winston';
import {
  afterStoreDocumentPayload,
  Extension,
  onLoadDocumentPayload,
  onStoreDocumentPayload,
} from '@hocuspocus/server';
import { FactoryProvider } from '@nestjs/common';
import { LogContext } from '@common/enums';
import { UtilService } from '@src/services/util';
import { isSaveErrorData } from '@src/services/integration/outputs';
import { STORAGE_EXTENSION } from './storage.extension.token';
import { AbstractStorage } from './abstract.storage';
import { afterStoreDocumentWithContextPayload } from '@src/hocuspocus/extensions/storage/after.store.document.with.context.payload';
import { StatelessMessage } from '@src/hocuspocus/stateless-messaging';

const StorageFactory: FactoryProvider<Extension> = {
  provide: STORAGE_EXTENSION,
  inject: [UtilService],
  useFactory: (utilService: UtilService, logger: WinstonLogger) => {
    return new (class Storage extends AbstractStorage {
      /**
       * Called once, when the first client connects to the server, during the creation of a new document.
       * Called after onAuthenticate
       * @param data
       */
      public onLoadDocument({ documentName: documentId }: onLoadDocumentPayload): Promise<Doc> {
        return utilService.fetchMemo(documentId);
      }
      /**
       * The onStoreDocument hooks are called after the document has been changed (after the onChange hook)
       * Calls to onStoreDocument are debounced by default (see debounce and maxDebounce configuration options).
       */
      public async onStoreDocument(data: onStoreDocumentPayload): Promise<any> {
        const { documentName: documentId, document, context } = data;
        const result = await utilService.save(documentId, document);

        if (isSaveErrorData(result.data)) {
          logger.error(
            {
              message: '[onStoreDocument] Received error when requesting to save the document.',
              errorMessage: result.data.error,
              documentId,
            },
            undefined,
            LogContext.STORAGE
          );

          context.saved = false;
          context.error = result.data.error;
        } else {
          context.saved = true;
        }

        return Promise.resolve();
      }

      public afterStoreDocument(data: afterStoreDocumentWithContextPayload): Promise<any> {
        const { document, context } = data;
        const statelessData = this.encodeStateless(
          context.error
            ? {
                event: 'save-error',
                error: context.error,
              }
            : {
                event: 'saved',
              }
        );

        if (statelessData) {
          document.broadcastStateless(statelessData);
        }

        return Promise.resolve();
      }

      private encodeStateless = (data: StatelessMessage): string | undefined => {
        try {
          return JSON.stringify(data);
        } catch (error: any) {
          logger.error(
            {
              message: 'Failed to encode stateless data.',
              cause: `Error while parsing data to JSON: ${error?.message}`,
            },
            error?.stack,
            LogContext.STORAGE
          );
        }
      };
    })();
  },
};
export default StorageFactory;
