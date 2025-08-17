import { Injectable } from '@nestjs/common';
import { UtilService } from '@src/services/util';
import { ReadOnlyCode } from '@src/hocuspocus/extensions/authorization/types';
import { ReadOnlyState } from '../types';

@Injectable()
export class AlkemioAuthorizationService {
  constructor(private readonly utilService: UtilService) {}

  /**
   * Checks if user has access to the document.
   */
  // public async getDocumentAccessAndInfo(
  //   userId: string,
  //   documentId: string
  // ): Promise<DocumentAccessInfo> {
  //   const {
  //     read: canRead,
  //     update: canUpdate,
  //     isMultiUser,
  //     maxCollaborators,
  //   } = await this.utilService.getUserAccessToMemo(userId, documentId);
  //
  //   return { canRead, canUpdate, isMultiUser, maxCollaborators };
  // }

  /**
   * Calculates the read-only state based on user permissions and document constraints.
   */
  public calculateReadOnlyState(
    update: boolean,
    isMultiUser: boolean,
    collaboratorCount: number,
    maxCollaborators: number
  ): ReadOnlyState {
    if (!update) {
      return { readOnly: true, readOnlyCode: ReadOnlyCode.NO_UPDATE_ACCESS };
    }

    if (collaboratorCount === 1 && !isMultiUser) {
      return { readOnly: true, readOnlyCode: ReadOnlyCode.MULTI_USER_NOT_ALLOWED };
    }

    // Using >= prevents race conditions where count could exceed max
    if (collaboratorCount >= maxCollaborators) {
      return { readOnly: true, readOnlyCode: ReadOnlyCode.ROOM_CAPACITY_REACHED };
    }

    return { readOnly: false, readOnlyCode: undefined };
  }
}
