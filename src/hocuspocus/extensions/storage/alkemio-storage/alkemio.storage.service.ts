import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { Doc } from 'yjs';
import { LogContext } from '@common/enums';
import { UtilService } from '@src/services/util';
import { isSaveErrorData } from '@src/services/integration/outputs';
import { StorageContext } from '../types';

@Injectable()
export class AlkemioStorageService {
  constructor(
    private readonly utilService: UtilService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: WinstonLogger
  ) {}

  /**
   * Loads a document from storage
   * @param documentId - The ID of the document to load
   * @returns Promise resolving to the document or null if not found
   */
  public async loadDocument(documentId: string): Promise<Doc> {
    return this.utilService.fetchMemo(documentId);
  }

  /**
   * Saves a document to storage
   * @param documentId - The ID of the document to save
   * @param document - The document to save
   * @returns Promise resolving to storage result
   */
  public async saveDocument(documentId: string, document: Doc): Promise<StorageContext> {
    const result = await this.utilService.save(documentId, document);

    if (isSaveErrorData(result.data)) {
      this.logger.error(
        {
          message: 'Received error when requesting to save the document',
          errorMessage: result.data.error,
          documentId,
        },
        undefined,
        LogContext.STORAGE
      );

      return {
        saved: false,
        error: result.data.error,
      };
    }

    this.logger.verbose?.(
      {
        message: 'Document saved successfully',
        documentId,
      },
      LogContext.STORAGE
    );

    return {
      saved: true,
    };
  }
}
