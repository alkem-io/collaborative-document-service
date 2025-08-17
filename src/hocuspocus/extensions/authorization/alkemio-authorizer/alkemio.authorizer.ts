import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import {
  connectedPayload,
  Hocuspocus,
  onAuthenticatePayload,
  onConnectPayload,
} from '@hocuspocus/server';
import { LogContext } from '@common/enums';
import { StatelessReadOnlyStateMessage } from '@src/hocuspocus/stateless-messaging';
import { HocuspocusConnectionService } from '@src/hocuspocus/services';
import { AlkemioAuthorizationService } from './alkemio.authorization.service';
import { AbstractAuthorizer } from '../abstract.authorizer';
import { AuthorizationResult, WithAuthorizationContext } from '../types';
import { ForbiddenException } from '../../authentication/exceptions';
import { onConnectSharedData } from '@src/hocuspocus/extensions/types';

export class AlkemioAuthorizer extends AbstractAuthorizer {
  constructor(
    private readonly authorizationService: AlkemioAuthorizationService,
    private readonly connectionService: HocuspocusConnectionService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: WinstonLogger
  ) {
    super(AlkemioAuthorizer.name);
  }

  async onConnect(data: onConnectPayload & onConnectSharedData) {
    if (!data.connectionConfig.isAuthenticated) {
      return Promise.reject();
    }

    const { documentName: documentId, userInfo } = data;

    if (!userInfo) {
      return Promise.reject();
    }

    const result = await this.authorizeDocumentAccess(userInfo.id, documentId, data.instance);

    return {
      ...result,
      userInfo,
      authorizedBy: 'onConnect',
    };
  }

  async onAuthenticate(data: WithAuthorizationContext<onAuthenticatePayload>) {
    if (!data.connectionConfig.isAuthenticated) {
      return Promise.reject();
    }

    const {
      documentName: documentId,
      context: { userInfo },
    } = data;

    if (!userInfo) {
      return Promise.reject();
    }

    const result = await this.authorizeDocumentAccess(userInfo.id, documentId, data.instance);

    return {
      ...result,
      userInfo,
      authorizedBy: 'onConnect',
    };
  }

  connected(data: WithAuthorizationContext<connectedPayload>): Promise<any> {
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

    if (this.logger.verbose) {
      const {
        context: { readOnly, readOnlyCode, maxCollaborators, isMultiUser, userInfo, authorizedBy },
      } = data;

      this.logger.verbose?.(
        {
          message: `[${authorizedBy}] User authorized`,
          userId: userInfo?.email,
          read: true,
          readOnly,
          readOnlyCode,
          isMultiUser,
          maxCollaborators,
          totalConnections,
          collaboratorCount,
          readOnlyCount,
        },
        LogContext.AUTHENTICATION
      );
    }

    return Promise.resolve();
  }

  /**
   * Authorizes user access to a document
   */
  async authorizeDocumentAccess(
    userId: string,
    documentId: string,
    instance: Hocuspocus
  ): Promise<AuthorizationResult> {
    const collaboratorCount = this.connectionService.getCollaboratorConnections(
      instance,
      documentId
    ).length;

    const result = await this.authorizationService.authorize(userId, documentId, collaboratorCount);

    if (!result.canRead) {
      this.logger.verbose?.(
        {
          message: 'User does not have read access to document',
          userId,
          documentId,
        },
        LogContext.AUTHENTICATION
      );

      throw new ForbiddenException(
        'User does not have read access to this document.',
        LogContext.AUTHENTICATION,
        { userId, documentId }
      );
    }

    return result;
  }
}
