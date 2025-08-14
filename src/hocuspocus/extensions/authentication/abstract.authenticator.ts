import { Extension, onAuthenticatePayload, onConnectPayload } from '@hocuspocus/server';

export abstract class AbstractAuthenticator implements Extension {
  /**
   * Called once, when a client is connecting.
   * This is the first method called by the server.
   * Whatever you return will be part of the context field on each hooks
   */
  public abstract onConnect(data: onConnectPayload): Promise<any>;
  /**
   * Only called after the client has sent the Auth message,
   * which won't happen if there is no token provided to HocuspocusProvider.
   */
  public abstract onAuthenticate(data: onAuthenticatePayload): Promise<any>;
}
