import { Extension, onAuthenticatePayload, onConnectPayload } from '@hocuspocus/server';
import { FactoryProvider } from '@nestjs/common';
import { LogContext } from '@common/enums';
import { UtilService } from '@src/services/util';
import { AUTHENTICATION_EXTENSION } from './authentication.extension.token';
import { AuthenticationException } from './authentication.exception';
import { AbstractAuthentication } from './abstract.authentication';

const AuthenticationFactory: FactoryProvider<Extension> = {
  provide: AUTHENTICATION_EXTENSION,
  inject: [UtilService],
  useFactory: (utilService: UtilService) => {
    return new (class Authentication extends AbstractAuthentication {
      /**
       * Called once, when a client is connecting.
       * This is the first method called by the server.
       * Whatever you return will be part of the context field on each hooks
       * @param data
       */
      async onConnect(data: onConnectPayload): Promise<any> {
        data.connectionConfig.readOnly = true; // not yet determined

        const { cookie, authorization } = data.requestHeaders;

        try {
          const userInfo = await utilService.getUserInfo({ cookie, authorization });
          data.connectionConfig.isAuthenticated = true;
          // attach to the context field
          return userInfo;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          data.connectionConfig.isAuthenticated = false;
          // do not throw an error for now - wait for onAuthenticate
        }

        // todo: authorize the document access here

        return Promise.resolve();
      }

      /**
       * Only called after the client has sent the Auth message,
       * which won't happen if there is no token provided to HocuspocusProvider.
       * @param data
       */
      onAuthenticate(data: onAuthenticatePayload): Promise<any> {
        if (data.connectionConfig.isAuthenticated) {
          return Promise.resolve();
        }
        // treat the token as a bearer token
        const { token } = data;
        const authorization = `Bearer ${token}`;
        // check token only
        try {
          const userInfo = utilService.getUserInfo({ authorization });
          data.connectionConfig.isAuthenticated = true;
          // attach to the context field
          return userInfo;
        } catch (e) {
          data.connectionConfig.isAuthenticated = false;
          throw new AuthenticationException(
            'Authentication failed. Please provide a valid token.',
            LogContext.AUTHENTICATION,
            { originalException: e }
          );
        }

        // todo: authorize the document access here
      }
    })();
  },
};
export default AuthenticationFactory;
