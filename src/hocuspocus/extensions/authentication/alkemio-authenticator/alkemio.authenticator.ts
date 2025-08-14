import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { connectedPayload, onAuthenticatePayload, onConnectPayload } from '@hocuspocus/server';
import { LogContext } from '@common/enums';
import { StatelessReadOnlyStateMessage } from '@src/hocuspocus/stateless-messaging';
import { HocuspocusConnectionService } from '@src/hocuspocus/services';
import { AbstractAuthenticator } from '../abstract.authenticator';
import { AuthContext, AuthResult, ReadOnlyCode, WithAuthContext } from '../types';
import { ForbiddenException, AuthenticationException } from '../exceptions';
import { AuthenticationService } from './authentication.service';
import { AuthorizationService } from './authorization.service';

@Injectable()
export class AlkemioAuthenticator extends AbstractAuthenticator {
  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly authorizationService: AuthorizationService,
    private readonly connectionService: HocuspocusConnectionService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: WinstonLogger
  ) {
    super();
  }

  /**
   * Main function that orchestrates authentication and authorization.
   * If the user is not authenticated, returns all the flags in default state.
   * If the user is authenticated and DOES NOT HAVE read access, an exception is thrown.
   * If the user is authenticated and has read access, returns all the information about the user and document
   * @throws ForbiddenException If the user is authenticated but does not have read access to the document.
   */
  private async authenticateAndAuthorize(
    handleName: string,
    documentId: string,
    collaboratorCount: number,
    auth: {
      cookie?: string;
      authorization?: string;
    }
  ): Promise<AuthResult> {
    const userInfo = await this.authenticationService.getUserIdentity(auth);

    if (!userInfo) {
      this.logger.verbose?.(
        `[${handleName}] User info is undefined, user is not authenticated.`,
        LogContext.AUTHENTICATION
      );
      return {
        isAuthenticated: false,
        read: false,
        readOnly: false,
        readOnlyCode: ReadOnlyCode.NOT_AUTHENTICATED,
        maxCollaborators: 0,
      };
    }

    // user is authenticated, but we need to check if they have access to the document
    const { canRead, canUpdate, isMultiUser, maxCollaborators } =
      await this.authorizationService.getDocumentAccessAndInfo(userInfo.id, documentId);

    // user is authenticated, but does not have read access to the document
    // refuse access
    if (!canRead) {
      this.logger.verbose?.(
        {
          message: `[${handleName}] User is authenticated but does not have READ access to the document. Refusing access....`,
          user: userInfo.email,
          documentId,
        },
        LogContext.AUTHENTICATION
      );
      throw new ForbiddenException(
        'User does not have read access to this document.',
        LogContext.AUTHENTICATION,
        { user: userInfo.email, documentId }
      );
    }

    // user is authenticated and has read access to the document
    // check the contributor access
    const { readOnly, readOnlyCode } = this.authorizationService.calculateReadOnlyState(
      canUpdate,
      isMultiUser,
      collaboratorCount,
      maxCollaborators
    );

    // return all the information we have about the user and document
    return {
      isAuthenticated: true,
      read: true,
      userInfo,
      readOnly,
      readOnlyCode,
      maxCollaborators,
    };
  }

  /**
   * Called once, when a client is connecting.
   * This is the first method called by the server.
   * Whatever you return will be part of the context field on each hooks
   */
  async onConnect(data: onConnectPayload): Promise<AuthContext | void> {
    const { cookie, authorization } = data.requestHeaders;
    const collaboratorCount = this.connectionService.getCollaboratorConnections(
      data.instance,
      data.documentName
    ).length;

    const { userInfo, readOnly, readOnlyCode, isAuthenticated, maxCollaborators } =
      await this.authenticateAndAuthorize('onConnect', data.documentName, collaboratorCount, {
        cookie,
        authorization,
      });

    data.connectionConfig.isAuthenticated = isAuthenticated;
    data.connectionConfig.readOnly = readOnly;

    // user is not authenticated, wait for onAuthenticate
    if (!isAuthenticated) {
      return Promise.resolve();
    }

    // user is authenticated, and has read access to the document
    return {
      userInfo,
      readOnly,
      readOnlyCode,
      maxCollaborators,
      authenticatedBy: 'onConnect',
    };
  }

  /**
   * Only called after the client has sent the Auth message,
   * which won't happen if there is no token provided to HocuspocusProvider.
   */
  async onAuthenticate(data: WithAuthContext<onAuthenticatePayload>): Promise<AuthContext | void> {
    // client is already authenticated by onConnect
    if (data.connectionConfig.isAuthenticated) {
      return Promise.resolve();
    }

    const contributorCount = this.connectionService.getCollaboratorConnections(
      data.instance,
      data.documentName
    ).length;

    // user has not been authenticated in onConnect, last chance to authenticate
    // treat the token as a bearer token
    const { token } = data;
    const authorization = `Bearer ${token}`;

    // check token only
    const { userInfo, readOnly, readOnlyCode, isAuthenticated, maxCollaborators } =
      await this.authenticateAndAuthorize('onAuthenticate', data.documentName, contributorCount, {
        authorization,
      });

    data.connectionConfig.isAuthenticated = isAuthenticated;
    data.connectionConfig.readOnly = readOnly;

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
      userInfo,
      readOnly,
      readOnlyCode,
      maxCollaborators,
      authenticatedBy: 'onAuthenticate',
    };
  }

  /**
   * Called once, after a new connection has been successfully established and the user is authenticated.
   */
  connected(data: WithAuthContext<connectedPayload>): Promise<any> {
    try {
      const statelessData = JSON.stringify({
        event: 'read-only-state',
        readOnly: data.connectionConfig.readOnly,
        readOnlyCode: data.context.readOnlyCode,
      } as StatelessReadOnlyStateMessage);
      data.connection.sendStateless(statelessData);
    } catch (e: any) {
      this.logger.error(
        {
          message: '[connected] Failed to send stateless data to the client.',
          error: e,
          documentId: data.documentName,
        },
        e?.stack,
        LogContext.AUTHENTICATION
      );
    }

    if (this.logger.verbose) {
      const {
        context: { authenticatedBy, readOnly, readOnlyCode, userInfo, maxCollaborators },
      } = data;
      const totalConnections = this.connectionService.getConnections(
        data.instance,
        data.documentName
      ).length;
      const collaboratorCount = this.connectionService.getCollaboratorConnections(
        data.instance,
        data.documentName
      ).length;
      const readOnlyCount = this.connectionService.getReadOnlyConnections(
        data.instance,
        data.documentName
      ).length;

      this.logger.verbose?.(
        {
          message: `[${authenticatedBy}] User authenticated`,
          userId: userInfo?.email,
          documentId: data.documentName,
          read: true,
          readOnly,
          readOnlyCode,
          maxCollaborators,
          totalConnections,
          readOnlyCount,
          collaboratorCount,
        },
        LogContext.AUTHENTICATION
      );
    }

    return Promise.resolve();
  }
}
