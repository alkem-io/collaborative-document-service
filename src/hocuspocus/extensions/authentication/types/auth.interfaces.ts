import { UserInfo } from '@src/services/integration/types';
import { ReadOnlyCode } from './read.only.code';

export interface DocumentAccessInfo {
  canRead: boolean;
  canUpdate: boolean;
  isMultiUser: boolean;
  maxCollaborators: number;
}

export interface ReadOnlyState {
  readOnly: boolean;
  readOnlyCode?: ReadOnlyCode;
}

export interface AuthResult {
  isAuthenticated: boolean;
  readOnly: boolean;
  readOnlyCode?: ReadOnlyCode;
  read: boolean;
  userInfo?: UserInfo;
  maxCollaborators: number;
}

export interface AuthContext {
  userInfo?: UserInfo;
  readOnly: boolean;
  readOnlyCode?: ReadOnlyCode;
  maxCollaborators: number;
  authenticatedBy?: 'onConnect' | 'onAuthenticate';
}

export type WithAuthContext<T extends { context: any }> = Omit<T, 'context'> & {
  context: AuthContext;
};
