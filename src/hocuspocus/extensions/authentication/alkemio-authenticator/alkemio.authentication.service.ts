import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { LogContext } from '@common/enums';
import { UtilService } from '@src/services/util';
import { UserInfo } from '@src/services/integration/types';

@Injectable()
export class AlkemioAuthenticationService {
  constructor(
    private readonly utilService: UtilService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: WinstonLogger
  ) {}

  /**
   * Gets user information from authentication data.
   * @returns UserInfo or undefined if authentication fails
   */
  public async getUserIdentity(auth: {
    cookie?: string;
    authorization?: string;
  }): Promise<UserInfo | undefined> {
    try {
      return await this.utilService.getUserInfo(auth);
    } catch (error: any) {
      this.logger.error(
        {
          message: 'Getting the user identity failed.',
          error,
        },
        error?.stack,
        LogContext.AUTHENTICATION
      );
      return undefined;
    }
  }
}
