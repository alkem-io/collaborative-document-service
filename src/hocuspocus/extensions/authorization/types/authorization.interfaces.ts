import { UserInfo } from '@src/services/integration/types';
import { ReadOnlyCode } from './read.only.code';

export interface AuthorizationResult {
  canRead: boolean;
  canUpdate: boolean;
  readOnly: boolean;
  readOnlyCode?: ReadOnlyCode;
  maxCollaborators: number;
  isMultiUser: boolean;
}

export interface DocumentPermissions {
  canRead: boolean;
  canUpdate: boolean;
  isMultiUser: boolean;
  maxCollaborators: number;
}

export type WithAuthorizationContext<T extends { context: any }> = Omit<T, 'context'> & {
  context: AuthorizationResult & {
    userInfo: UserInfo;
    authorizedBy: 'onConnect' | 'onAuthenticate';
  };
};
