import * as Y from 'yjs';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { Inject, Injectable } from '@nestjs/common';
import { LogContext } from '@common/enums';
import { FetchInputData, InfoInputData, SaveInputData } from '../integration/inputs';
import { InfoOutputData, isFetchErrorData } from '../integration/outputs';
import { IntegrationService } from '../integration';
import { FetchException } from './fetch.exception';
import { binaryStateV2ToYjsDoc, yjsDocToBinaryStateV2 } from './transform';

@Injectable()
export class UtilService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: WinstonLogger,
    private readonly integrationService: IntegrationService
  ) {}

  public async getUserAccessToMemo(userId: string, memoId: string): Promise<InfoOutputData> {
    try {
      return await this.integrationService.info(new InfoInputData(userId, memoId));
    } catch (error: any) {
      this.logger.error(
        {
          message: 'Received error while getting user access to Memo',
          userId,
          memoId,
          error,
        },
        error?.stack,
        LogContext.UTIL
      );
      return new InfoOutputData(false, false, false, 0);
    }
  }

  public save(documentId: string, document: Y.Doc) {
    const binaryStateV2 = yjsDocToBinaryStateV2(document);
    const binaryStateInBase64 = Buffer.from(binaryStateV2).toString('base64');

    return this.integrationService.save(new SaveInputData(documentId, binaryStateInBase64));
  }

  /**
   * Fetches the content of the Y.doc from DB
   * @param documentId Document ID
   * @throws FetchException if the fetch fails
   */
  public async fetchMemo(documentId: string): Promise<Y.Doc> {
    const { data } = await this.integrationService.fetch(new FetchInputData(documentId));

    if (isFetchErrorData(data)) {
      throw new FetchException('Failed to fetch memo', LogContext.UTIL, {
        originalError: data.error,
        code: data.code,
      });
    }
    const binaryStateV2 = data.contentBase64
      ? Buffer.from(data.contentBase64, 'base64')
      : undefined;

    return binaryStateV2ToYjsDoc(binaryStateV2);
  }
}
