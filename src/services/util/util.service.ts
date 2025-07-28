import { Doc as YjsDoc } from 'yjs';
import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { NotProvidedException } from '@common/exceptions';
import { LogContext } from '@common/enums';
import { UserInfo } from '../integration/user.info';
import { FetchInputData, SaveInputData, WhoInputData } from '../integration/inputs';
import { isFetchErrorData } from '../integration/outputs';
import { IntegrationService } from '../integration/integration.service';

@Injectable()
export class UtilService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private logger: LoggerService,
    private readonly integrationService: IntegrationService
  ) {}

  public async getUserInfo(opts: {
    cookie?: string;
    authorization?: string;
  }): Promise<UserInfo | never> {
    const { cookie, authorization } = opts;
    // we want to choose the authorization with priority
    if (authorization) {
      return this.integrationService.who(new WhoInputData({ authorization }));
    }

    if (cookie) {
      return this.integrationService.who(new WhoInputData({ cookie }));
    }

    throw new NotProvidedException(
      'Not able to get user info. At least one of: Cookie and Authorization headers need not be provided',
      LogContext.INTEGRATION
    );
  }

  public save(roomId: string, document: YjsDoc) {
    return this.integrationService.save(new SaveInputData(roomId, document));
  }

  /**
   * Fetches the content of the whiteboard from DB or if not found returns an initial empty content.
   * @param roomId Whiteboard ID
   */
  public async fetchContentFromDbOrEmpty(roomId: string): Promise<ExcalidrawContent> {
    const { data } = await this.integrationService.fetch(new FetchInputData(roomId));

    if (isFetchErrorData(data)) {
      return excalidrawInitContent;
    }

    try {
      return JSON.parse(data.content);
    } catch (e: any) {
      this.logger.error(e, e?.stack);
      return excalidrawInitContent;
    }
  }
}
