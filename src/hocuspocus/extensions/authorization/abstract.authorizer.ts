import { Extension, onAuthenticatePayload, onConnectPayload } from '@hocuspocus/server';

export abstract class AbstractAuthorizer implements Extension {
  protected constructor(
    public extensionName: string,
    public priority?: number
  ) {}
  /**
   * Called during connection to check authorization
   */
  public abstract onConnect(data: onConnectPayload): Promise<any>;

  /**
   * Called during authentication to verify access
   */
  public abstract onAuthenticate(data: onAuthenticatePayload): Promise<any>;
}
