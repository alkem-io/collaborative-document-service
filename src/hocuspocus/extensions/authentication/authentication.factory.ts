import {
  connectedPayload,
  Extension,
  Hocuspocus,
  onAuthenticatePayload,
  onConnectPayload,
} from '@hocuspocus/server';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { FactoryProvider } from '@nestjs/common';
import { LogContext } from '@common/enums';
import { UtilService } from '@src/services/util';
import { StatelessReadOnlyStateMessage } from '@src/hocuspocus/stateless-messaging';
import { UserInfo } from '@src/services/integration/types';
import { AUTHENTICATION_EXTENSION } from './authentication.extension.token';
import { AbstractAuthentication } from './abstract.authentication';
import { ForbiddenException } from './forbidden.exception';
import { AuthenticationException } from './authentication.exception';
import { ReadOnlyCode } from './read.only.code';

type AuthContext = {
  userInfo?: UserInfo;
  readOnly: boolean;
  readOnlyCode?: ReadOnlyCode;
  maxCollaborators: number;
  authenticatedBy?: 'onConnect' | 'onAuthenticate';
};

type WithAuthContext<T extends { context: any }> = Omit<T, 'context'> & {
  context: AuthContext;
};

const AuthenticationFactory: FactoryProvider<Extension> = {
  provide: AUTHENTICATION_EXTENSION,
  inject: [UtilService, WINSTON_MODULE_NEST_PROVIDER],
  useFactory: (utilService: UtilService, logger: WinstonLogger) => {
    /**
     * @throws ForbiddenException If the user is authenticated but does not have read access to the document.
     */
    // todo: split logic in multiple functions
    const authenticateAndAuthorize = async (
      handleName: string,
      documentId: string,
      collaboratorCount: number,
      auth: {
        cookie?: string;
        authorization?: string;
      }
    ): Promise<{
      isAuthenticated: boolean;
      readOnly: boolean;
      readOnlyCode?: ReadOnlyCode;
      read: boolean;
      userInfo?: UserInfo;
      maxCollaborators: number;
    }> => {
      const { cookie, authorization } = auth;
      let userInfo: UserInfo | undefined;
      try {
        userInfo = await utilService.getUserInfo({ cookie, authorization });
      } catch (error: any) {
        logger.error(
          {
            message: `[${handleName}] Getting the client info failed. Defaulting to readOnly=true, isAuthenticated=false.`,
            error,
          },
          error?.stack,
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

      // user is authenticated, now check the access to the document
      const {
        read: canRead,
        update: canUpdate,
        isMultiUser,
        maxCollaborators,
      } = await utilService.getUserAccessToMemo(userInfo.id, documentId);
      // user is authenticated, but does not have read access to the document - disconnect
      // here it does not make sense to potentially retry again in a different hook, since the READ won't change
      if (!canRead) {
        logger.verbose?.(
          {
            message: `[${handleName}] Client is authenticated but does not have READ access to the document.`,
            userId: userInfo?.email,
            documentId,
          },
          LogContext.AUTHENTICATION
        );
        throw new ForbiddenException(
          'User does not have read access to this document.',
          LogContext.AUTHENTICATION,
          {
            userId: userInfo.id,
            documentId,
          }
        );
      }
      // user is authenticated, and has read access to the document
      // calculate the read-only state and the reason if applicable

      const { readOnly, readOnlyCode } = calculateReadOnlyState(
        canUpdate,
        isMultiUser,
        collaboratorCount,
        maxCollaborators
      );
      // push the gathered info to the context
      return {
        isAuthenticated: true,
        read: true,
        userInfo,
        readOnly,
        readOnlyCode,
        maxCollaborators,
      };
    };

    const calculateReadOnlyState = (
      update: boolean,
      isMultiUser: boolean,
      collaboratorCount: number,
      maxCollaborators: number
    ): { readOnly: boolean; readOnlyCode?: ReadOnlyCode } => {
      if (!update) {
        return { readOnly: true, readOnlyCode: ReadOnlyCode.NO_UPDATE_ACCESS };
      }

      if (collaboratorCount === 1 && !isMultiUser) {
        return { readOnly: true, readOnlyCode: ReadOnlyCode.MULTI_USER_NOT_ALLOWED };
      }

      if (collaboratorCount === maxCollaborators) {
        return { readOnly: true, readOnlyCode: ReadOnlyCode.ROOM_CAPACITY_REACHED };
      }

      return { readOnly: false, readOnlyCode: undefined };
    };

    /**
     * @returns The number of registered connections to the document. That does not include direct connections.
     */
    const getConnections = (instance: Hocuspocus, documentName: string) => {
      return instance.documents.get(documentName)?.getConnections() ?? [];
    };

    const getReadOnlyConnections = (instance: Hocuspocus, documentName: string) => {
      const connections = getConnections(instance, documentName);

      if (!connections || connections.length === 0) {
        return [];
      }

      return connections.filter(connection => connection.readOnly);
    };

    const getCollaboratorConnections = (instance: Hocuspocus, documentName: string) => {
      const connections = getConnections(instance, documentName);

      if (!connections || connections.length === 0) {
        return [];
      }

      return connections.filter(connection => !connection.readOnly);
    };

    return new (class Authentication extends AbstractAuthentication {
      /**
       * Called once, when a client is connecting.
       * This is the first method called by the server.
       * Whatever you return will be part of the context field on each hooks
       * @param data
       */
      async onConnect(data: onConnectPayload): Promise<AuthContext | void> {
        const { cookie, authorization } = data.requestHeaders;
        const collaboratorCount = getCollaboratorConnections(
          data.instance,
          data.documentName
        ).length;

        const { userInfo, readOnly, readOnlyCode, isAuthenticated, maxCollaborators } =
          await authenticateAndAuthorize('onConnect', data.documentName, collaboratorCount, {
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
       * @param data
       */
      async onAuthenticate(
        data: WithAuthContext<onAuthenticatePayload>
      ): Promise<AuthContext | void> {
        // client is already authenticated by onConnect
        if (data.connectionConfig.isAuthenticated) {
          return Promise.resolve();
        }
        const contributorCount = getCollaboratorConnections(
          data.instance,
          data.documentName
        ).length;
        // user has not been authenticated in onConnect, last chance to authenticate
        // treat the token as a bearer token
        const { token } = data;
        const authorization = `Bearer ${token}`;
        // check token only
        const { userInfo, readOnly, readOnlyCode, isAuthenticated, maxCollaborators } =
          await authenticateAndAuthorize('onAuthenticate', data.documentName, contributorCount, {
            authorization,
          });
        data.connectionConfig.isAuthenticated = isAuthenticated;
        data.connectionConfig.readOnly = readOnly;
        // user is NOT authenticated - disconnect
        if (!isAuthenticated) {
          logger.verbose?.(
            {
              message: '[onAuthenticate] Client failed to authenticate.',
              userId: userInfo?.email,
              documentId: data.documentName,
            },
            LogContext.AUTHENTICATION
          ); // user is not authenticated, disconnect
          throw new AuthenticationException(
            'User is not authenticated.',
            LogContext.AUTHENTICATION,
            {
              userId: userInfo?.id,
              documentId: data.documentName,
            }
          );
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
       * @param data
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
          logger.error(
            {
              message: '[connected] Failed to send stateless data to the client.',
              error: e,
              documentId: data.documentName,
            },
            e?.stack,
            LogContext.AUTHENTICATION
          );
        }
        if (logger.verbose) {
          const {
            context: { authenticatedBy, readOnly, readOnlyCode, userInfo, maxCollaborators },
          } = data;
          const totalConnections = getConnections(data.instance, data.documentName).length;
          const collaboratorCount = getCollaboratorConnections(
            data.instance,
            data.documentName
          ).length;
          const readOnlyCount = getReadOnlyConnections(data.instance, data.documentName).length;
          logger.verbose?.(
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
    })();
  },
};
export default AuthenticationFactory;
