import * as Y from 'yjs';
import { Inject, Injectable } from '@nestjs/common';
import { NotProvidedException } from '@common/exceptions';
import { LogContext } from '@common/enums';
import { UserInfo } from '../integration/types';
import { FetchInputData, InfoInputData, SaveInputData, WhoInputData } from '../integration/inputs';
import { InfoOutputData, isFetchErrorData } from '../integration/outputs';
import { IntegrationService } from '../integration';
import { FetchException } from '@src/services/util/fetch.exception';

import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';

@Injectable()
export class UtilService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: WinstonLogger,
    private readonly integrationService: IntegrationService
  ) {}

  /**
   * Fetches user information based on the provided cookie or authorization header.
   * If both are provided, authorization header takes precedence.
   * @throws NotProvidedException if neither is provided.
   * @param opts
   */
  public getUserInfo(opts: {
    cookie?: string;
    authorization?: string;
  }): Promise<UserInfo | undefined> {
    const { cookie, authorization } = opts;
    // we want to choose the authorization with priority
    if (authorization) {
      return this.integrationService.who(new WhoInputData({ authorization }));
    }

    if (cookie) {
      return this.integrationService.who(new WhoInputData({ cookie }));
    }

    throw new NotProvidedException(
      'Not able to get user info. At least one of: Cookie and Authorization headers needs to be provided',
      LogContext.INTEGRATION
    );
  }

  public async getUserAccessToMemo(userId: string, memoId: string): Promise<InfoOutputData> {
    try {
      return this.integrationService.info(new InfoInputData(userId, memoId));
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
      return {
        read: false,
        update: false,
        isMultiUser: false,
        maxCollaborators: 0,
      };
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
/**
 * Returns the v2 binary state of the Y.Doc. V2 update format provides much better compression.
 *
 * <b>To not be confused with the v1 binary state, which is not compatible with the v2.</b>
 * @param doc
 */
const yjsDocToBinaryStateV2 = (doc: Y.Doc): Uint8Array => {
  return Y.encodeStateAsUpdateV2(doc);
};

const binaryStateV2ToYjsDoc = (binaryV2State: Buffer | undefined): Y.Doc => {
  const doc = new Y.Doc();

  if (binaryV2State) {
    Y.applyUpdateV2(doc, new Uint8Array(binaryV2State));
  }

  return doc;
};
