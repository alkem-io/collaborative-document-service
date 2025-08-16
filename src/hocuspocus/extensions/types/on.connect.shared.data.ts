import { UserInfo } from '@src/services/integration/types';

/**
 * A field to share data between extensions on the onConnect hook.
 */
export type onConnectSharedData = {
  userInfo?: UserInfo;
};
