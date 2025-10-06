import { Injectable } from '@nestjs/common';
import { UtilService } from '@src/services/util';
import { AuthorizationResult, DocumentPermissions, ReadOnlyCode } from '../types';

@Injectable()
export class AlkemioAuthorizationService {
  constructor(private readonly utilService: UtilService) {}

  /**
   * Gets document permissions for a user
   */
  async getDocumentPermissions(userId: string, documentId: string): Promise<DocumentPermissions> {
    const {
      read: canRead,
      update: canUpdate,
      isMultiUser,
      maxCollaborators,
    } = await this.utilService.getUserAccessToMemo(userId, documentId);

    return { canRead, canUpdate, isMultiUser, maxCollaborators };
  }

  /**
   * Determines authorization based on context and permissions
   */
  async authorize(
    userId: string,
    documentId: string,
    collaboratorCount: number
  ): Promise<AuthorizationResult> {
    const permissions = await this.getDocumentPermissions(userId, documentId);

    if (!permissions.canRead) {
      return {
        canRead: false,
        canUpdate: false,
        readOnly: true,
        readOnlyCode: ReadOnlyCode.NO_UPDATE_ACCESS, // Use existing enum value for now
        maxCollaborators: permissions.maxCollaborators,
        isMultiUser: permissions.isMultiUser,
      };
    }

    const readOnlyState = this.calculateReadOnlyState(
      permissions.canUpdate,
      permissions.isMultiUser,
      collaboratorCount,
      permissions.maxCollaborators
    );

    return {
      canRead: true,
      canUpdate: permissions.canUpdate,
      readOnly: readOnlyState.readOnly,
      readOnlyCode: readOnlyState.readOnlyCode,
      maxCollaborators: permissions.maxCollaborators,
      isMultiUser: permissions.isMultiUser,
    };
  }

  /**
   * Calculates read-only state based on permissions and constraints
   */
  private calculateReadOnlyState(
    canUpdate: boolean,
    isMultiUser: boolean,
    collaboratorCount: number,
    maxCollaborators: number
  ): { readOnly: boolean; readOnlyCode?: ReadOnlyCode } {
    if (!canUpdate) {
      return { readOnly: true, readOnlyCode: ReadOnlyCode.NO_UPDATE_ACCESS };
    }

    if (collaboratorCount > 0 && !isMultiUser) {
      return { readOnly: true, readOnlyCode: ReadOnlyCode.MULTI_USER_NOT_ALLOWED };
    }

    if (collaboratorCount >= maxCollaborators) {
      return { readOnly: true, readOnlyCode: ReadOnlyCode.ROOM_CAPACITY_REACHED };
    }

    return { readOnly: false };
  }
}
