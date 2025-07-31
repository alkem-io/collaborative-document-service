import { Extension, onAuthenticatePayload, onConnectPayload } from '@hocuspocus/server';
import { FactoryProvider } from '@nestjs/common';
import { LogContext } from '@common/enums';
import { UtilService } from '@src/services/util';
import { AUTHENTICATION_EXTENSION } from './authentication.extension.token';
import { AuthenticationException } from './authentication.exception';
import { AbstractAuthentication } from './abstract.authentication';
import { WinstonLogger } from 'nest-winston';
import { UserInfo } from '@src/services/integration/types';

const AuthenticationFactory: FactoryProvider<Extension> = {
  provide: AUTHENTICATION_EXTENSION,
  inject: [UtilService],
  useFactory: (utilService: UtilService, logger: WinstonLogger) => {
    /**
     *
     * @param handleName
     * @param documentId
     * @param auth
     */
    const authenticateAndAuthorize = async (
      handleName: string,
      documentId: string,
      auth: {
        cookie?: string;
        authorization?: string;
      }
    ): Promise<{
      isAuthenticated: boolean;
      readOnly: boolean;
      read: boolean;
      userInfo?: UserInfo;
    }> => {
      const { cookie, authorization } = auth;
      let userInfo: UserInfo | undefined;
      try {
        userInfo = await utilService.getUserInfo({ cookie, authorization });
      } catch (error: any) {
        logger.error(
          {
            message: `[${handleName}] Getting the user info failed. Defaulting to readOnly=true, isAuthenticated=false.`,
            error,
          },
          error?.stack,
          LogContext.AUTHENTICATION
        );
        return { isAuthenticated: false, readOnly: false, read: false };
      }
      // user is authenticated, now check the access to the document
      const { read, update } = await utilService.getUserAccessToMemo(userInfo.id, documentId);
      // user is authenticated, but does not have read access to the document - disconnect
      if (!read) {
        throw new AuthenticationException(
          'User does not have read access to this document.',
          LogContext.AUTHENTICATION,
          {
            userId: userInfo.id,
            documentId,
          }
        );
      }
      // user is authenticated, and has read access to the document
      // push the user info to the context
      return { isAuthenticated: true, userInfo, read: true, readOnly: !update };
    };

    return new (class Authentication extends AbstractAuthentication {
      /**
       * Called once, when a client is connecting.
       * This is the first method called by the server.
       * Whatever you return will be part of the context field on each hooks
       * @param data
       */
      async onConnect(data: onConnectPayload): Promise<any> {
        const { cookie, authorization } = data.requestHeaders;
        const { userInfo, read, readOnly, isAuthenticated } = await authenticateAndAuthorize(
          'onConnect',
          data.documentName,
          {
            cookie,
            authorization,
          }
        );

        data.connectionConfig.isAuthenticated = isAuthenticated;
        data.connectionConfig.readOnly = readOnly;
        // user is not authenticated, wait for onAuthenticate
        if (!isAuthenticated) {
          return Promise.resolve();
        }
        // user is authenticated, but does not have read access to the document - disconnect
        if (!read) {
          throw new AuthenticationException(
            'User does not have read access to this document.',
            LogContext.AUTHENTICATION,
            {
              userId: userInfo?.id,
              documentId: data.documentName,
            }
          );
        }
        // user is authenticated, and has read access to the document
        // push the user info to the context
        return { userInfo };
      }

      /**
       * Only called after the client has sent the Auth message,
       * which won't happen if there is no token provided to HocuspocusProvider.
       * @param data
       */
      async onAuthenticate(data: onAuthenticatePayload): Promise<any> {
        // client is already authenticated by onConnect
        if (data.connectionConfig.isAuthenticated) {
          return Promise.resolve();
        }
        // user has not been authenticated in onConnect, last chance to authenticate
        // treat the token as a bearer token
        const { token } = data;
        const authorization = `Bearer ${token}`;
        // check token only
        const { userInfo, read, readOnly, isAuthenticated } = await authenticateAndAuthorize(
          'onAuthenticate',
          data.documentName,
          { authorization }
        );
        data.connectionConfig.isAuthenticated = isAuthenticated;
        data.connectionConfig.readOnly = readOnly;
        // user is NOT authenticated - disconnect
        if (!isAuthenticated) {
          // user is not authenticated, disconnect
          throw new AuthenticationException(
            'User is not authenticated.',
            LogContext.AUTHENTICATION,
            {
              userId: userInfo?.id,
              documentId: data.documentName,
            }
          );
        }
        // user is authenticated, but does not have read access to the document - disconnect
        if (!read) {
          throw new AuthenticationException(
            'User does not have read access to this document.',
            LogContext.AUTHENTICATION,
            {
              userId: userInfo?.id,
              documentId: data.documentName,
            }
          );
        }
        // user is authenticated, and has read access to the document
        return { userInfo };
      }
    })();
  },
};
export default AuthenticationFactory;
