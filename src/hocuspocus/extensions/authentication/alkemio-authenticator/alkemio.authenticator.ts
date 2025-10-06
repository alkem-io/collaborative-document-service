import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { connectedPayload, onAuthenticatePayload, onConnectPayload } from '@hocuspocus/server';
import { LogContext } from '@common/enums';
import { onConnectSharedData } from '../../types';
import { AbstractAuthenticator } from '../abstract.authenticator';
import { AuthenticationContext, AuthenticationResult, WithAuthenticationContext } from '../types';
import { AuthenticationException } from '../exceptions';
import { AlkemioAuthenticationService } from './alkemio.authentication.service';

@Injectable()
export class AlkemioAuthenticator extends AbstractAuthenticator {
  constructor(
    private readonly authenticationService: AlkemioAuthenticationService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: WinstonLogger
  ) {
    super(AlkemioAuthenticator.name);
  }
  /**
   * Called once, when a client is connecting.
   * This is the first method called by the server.
   * Whatever you return will be part of the context field on each hooks
   */
  async onConnect(
    data: onConnectPayload & onConnectSharedData
  ): Promise<AuthenticationContext | void> {
    const { cookie, authorization } = data.requestHeaders;

    const { isAuthenticated, userInfo } = await this.authenticate('onConnect', {
      cookie,
      authorization,
    });

    data.connectionConfig.isAuthenticated = isAuthenticated;

    // user is not authenticated, wait for onAuthenticate
    if (!isAuthenticated) {
      return Promise.resolve();
    }
    // share this with all other extensions on the same hook
    data.userInfo = userInfo;
    // user is authenticated
    return {
      isAuthenticated: true,
      authenticatedBy: 'onConnect',
      userInfo,
    };
  }

  /**
   * Only called after the client has sent the Auth message,
   * which won't happen if there is no token provided to HocuspocusProvider.
   */
  async onAuthenticate(
    data: WithAuthenticationContext<onAuthenticatePayload>
  ): Promise<AuthenticationContext | void> {
    // client is already authenticated by onConnect
    if (data.connectionConfig.isAuthenticated) {
      return Promise.resolve();
    }

    const { token } = data;
    const authorization = `Bearer ${token}`;

    const { userInfo, isAuthenticated } = await this.authenticate('onAuthenticate', {
      authorization,
    });

    data.connectionConfig.isAuthenticated = isAuthenticated;

    // user is NOT authenticated - disconnect
    if (!isAuthenticated) {
      this.logger.verbose?.(
        {
          message: '[onAuthenticate] Client failed to authenticate.',
          userId: userInfo?.email,
          documentId: data.documentName,
        },
        LogContext.AUTHENTICATION
      );
      throw new AuthenticationException('User is not authenticated.', LogContext.AUTHENTICATION, {
        userId: userInfo?.id,
        documentId: data.documentName,
      });
    }
    // user is authenticated, and has read access to the document
    return {
      isAuthenticated: true,
      authenticatedBy: 'onAuthenticate',
      userInfo,
    };
  }

  /**
   * Called once, after a new connection has been successfully established and the user is authenticated.
   */
  connected(data: WithAuthenticationContext<connectedPayload>): Promise<any> {
    if (this.logger.verbose) {
      const {
        context: { authenticatedBy, userInfo },
      } = data;

      this.logger.verbose?.(
        `[${authenticatedBy}] User ${userInfo!.email} authenticated`,
        LogContext.AUTHENTICATION
      );
    }

    return Promise.resolve();
  }

  /**
   * Main function that handles authentication flow.
   * Delegates authorization to the authorization extension.
   */
  private async authenticate(
    handleName: string,
    auth: {
      cookie?: string;
      authorization?: string;
    }
  ): Promise<AuthenticationResult> {
    const userInfo = await this.authenticationService.getUserIdentity(auth);

    if (!userInfo) {
      this.logger.verbose?.(
        `[${handleName}] User info is undefined, user is not authenticated.`,
        LogContext.AUTHENTICATION
      );
      return {
        isAuthenticated: false,
      };
    }

    return {
      isAuthenticated: true,
      userInfo,
    };
  }
}
