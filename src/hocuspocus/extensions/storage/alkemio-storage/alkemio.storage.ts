import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import {
  afterStoreDocumentPayload,
  onLoadDocumentPayload,
  onStoreDocumentPayload,
} from '@hocuspocus/server';
import { Doc } from 'yjs';
import { LogContext } from '@common/enums';
import { AbstractStorage } from '../abstract.storage';
import { StorageContext, WithStorageContext } from '../types';
import { AlkemioStorageService } from './alkemio.storage.service';
import { StatelessMessage } from '../../../stateless-messaging';

@Injectable()
export class AlkemioStorage extends AbstractStorage {
  constructor(
    private readonly storageService: AlkemioStorageService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: WinstonLogger
  ) {
    super(AlkemioStorage.name);
  }

  /**
   * Called once, when the first client connects to the server, during the creation of a new document.
   * Called after onAuthenticate
   */
  public async onLoadDocument({
    documentName: documentId,
  }: onLoadDocumentPayload): Promise<Doc | null> {
    try {
      return await this.storageService.loadDocument(documentId);
    } catch (error: any) {
      this.logger.error(
        {
          message: 'Failed to load document.',
          documentId,
          error,
        },
        error?.stack,
        LogContext.STORAGE
      );
      // Return null to let Hocuspocus create a new document
      throw error;
    }
  }

  /**
   * The onStoreDocument hooks are called after the document has been changed (after the onChange hook)
   * Calls to onStoreDocument are debounced by default (see debounce and maxDebounce configuration options).
   */
  public async onStoreDocument(data: onStoreDocumentPayload): Promise<StorageContext> {
    const { documentName: documentId, document } = data;

    const result = await this.storageService.saveDocument(documentId, document);

    if (!result.saved) {
      this.logger.error(
        {
          message: 'Failed to save document.',
          documentId,
          error: result.error,
        },
        undefined,
        LogContext.STORAGE
      );
    }

    return {
      saved: result.saved,
      error: result.error,
    };
  }

  /**
   * Called after the document has been stored
   */
  public async afterStoreDocument(
    data: WithStorageContext<afterStoreDocumentPayload>
  ): Promise<void> {
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
  }

  private encodeStateless(data: StatelessMessage): string | undefined {
    try {
      return JSON.stringify(data);
    } catch (error: any) {
      this.logger.error(
        {
          message: 'Failed to encode stateless data.',
          cause: `Error while parsing data to JSON: ${error?.message}`,
        },
        error?.stack,
        LogContext.STORAGE
      );
      return undefined;
    }
  }
}
