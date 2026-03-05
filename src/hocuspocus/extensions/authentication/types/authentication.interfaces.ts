import { UserInfo } from '@src/services/integration/types';
import { ReadOnlyCode } from '../../authorization/types';

export interface ReadOnlyState {
  readOnly: boolean;
  readOnlyCode?: ReadOnlyCode;
}

export interface AuthenticationResult {
  isAuthenticated: boolean;
  userInfo?: UserInfo;
}

export interface AuthenticationContext {
  isAuthenticated: boolean;
  authenticatedBy?: 'onConnect' | 'onAuthenticate';
  userInfo?: UserInfo;
}

export type WithAuthenticationContext<T extends { context: any }> = Omit<T, 'context'> & {
  context: AuthenticationContext;
};
