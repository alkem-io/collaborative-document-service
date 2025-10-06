import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { AlkemioAuthorizationService } from './alkemio.authorization.service';
import { UtilService } from '@src/services/util';
import { ReadOnlyCode } from '../types';
import { InfoOutputData } from '@src/services/integration/outputs';

describe('AlkemioAuthorizationService', () => {
  let service: AlkemioAuthorizationService;
  let mockUtilService: MockProxy<UtilService>;

  beforeEach(async () => {
    mockUtilService = mock<UtilService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlkemioAuthorizationService,
        {
          provide: UtilService,
          useValue: mockUtilService,
        },
      ],
    }).compile();

    service = module.get<AlkemioAuthorizationService>(AlkemioAuthorizationService);
  });

  describe('getDocumentPermissions', () => {
    it('should return document permissions when user has access', async () => {
      // Arrange
      const userId = 'user123';
      const documentId = 'doc456';
      const mockMemoAccess = new InfoOutputData(true, true, true, 5);
      mockUtilService.getUserAccessToMemo.mockResolvedValue(mockMemoAccess);

      // Act
      const result = await service.getDocumentPermissions(userId, documentId);

      // Assert
      expect(result).toEqual({
        canRead: true,
        canUpdate: true,
        isMultiUser: true,
        maxCollaborators: 5,
      });
      expect(mockUtilService.getUserAccessToMemo).toHaveBeenCalledWith(userId, documentId);
    });

    it('should return document permissions when user has limited access', async () => {
      // Arrange
      const userId = 'user123';
      const documentId = 'doc456';
      const mockMemoAccess = new InfoOutputData(true, false, false, 1);
      mockUtilService.getUserAccessToMemo.mockResolvedValue(mockMemoAccess);

      // Act
      const result = await service.getDocumentPermissions(userId, documentId);

      // Assert
      expect(result).toEqual({
        canRead: true,
        canUpdate: false,
        isMultiUser: false,
        maxCollaborators: 1,
      });
    });

    it('should return document permissions when user has no access', async () => {
      // Arrange
      const userId = 'user123';
      const documentId = 'doc456';
      const mockMemoAccess = new InfoOutputData(false, false, false, 0);
      mockUtilService.getUserAccessToMemo.mockResolvedValue(mockMemoAccess);

      // Act
      const result = await service.getDocumentPermissions(userId, documentId);

      // Assert
      expect(result).toEqual({
        canRead: false,
        canUpdate: false,
        isMultiUser: false,
        maxCollaborators: 0,
      });
    });
  });

  describe('authorize', () => {
    describe('failing paths', () => {
      it('should deny authorization when user cannot read', async () => {
        // Arrange
        const userId = 'user123';
        const documentId = 'doc456';
        const collaboratorCount = 1;
        const mockMemoAccess = new InfoOutputData(false, false, true, 5);
        mockUtilService.getUserAccessToMemo.mockResolvedValue(mockMemoAccess);

        // Act
        const result = await service.authorize(userId, documentId, collaboratorCount);

        // Assert
        expect(result).toEqual({
          canRead: false,
          canUpdate: false,
          readOnly: true,
          readOnlyCode: ReadOnlyCode.NO_UPDATE_ACCESS,
          maxCollaborators: 5,
          isMultiUser: true,
        });
      });

      it('should set read-only when user cannot update', async () => {
        // Arrange
        const userId = 'user123';
        const documentId = 'doc456';
        const collaboratorCount = 1;
        const mockMemoAccess = new InfoOutputData(true, false, true, 5);
        mockUtilService.getUserAccessToMemo.mockResolvedValue(mockMemoAccess);

        // Act
        const result = await service.authorize(userId, documentId, collaboratorCount);

        // Assert
        expect(result).toEqual({
          canRead: true,
          canUpdate: false,
          readOnly: true,
          readOnlyCode: ReadOnlyCode.NO_UPDATE_ACCESS,
          maxCollaborators: 5,
          isMultiUser: true,
        });
      });

      it('should set read-only when collaborator count is 1 and multi-user is not allowed', async () => {
        // Arrange
        const userId = 'user123';
        const documentId = 'doc456';
        const collaboratorCount = 1;
        const mockMemoAccess = new InfoOutputData(true, true, false, 5);
        mockUtilService.getUserAccessToMemo.mockResolvedValue(mockMemoAccess);

        // Act
        const result = await service.authorize(userId, documentId, collaboratorCount);

        // Assert
        expect(result).toEqual({
          canRead: true,
          canUpdate: true,
          readOnly: true,
          readOnlyCode: ReadOnlyCode.MULTI_USER_NOT_ALLOWED,
          maxCollaborators: 5,
          isMultiUser: false,
        });
      });

      it('should set read-only when room capacity is reached', async () => {
        // Arrange
        const userId = 'user123';
        const documentId = 'doc456';
        const collaboratorCount = 5;
        const mockMemoAccess = new InfoOutputData(true, true, true, 5);
        mockUtilService.getUserAccessToMemo.mockResolvedValue(mockMemoAccess);

        // Act
        const result = await service.authorize(userId, documentId, collaboratorCount);

        // Assert
        expect(result).toEqual({
          canRead: true,
          canUpdate: true,
          readOnly: true,
          readOnlyCode: ReadOnlyCode.ROOM_CAPACITY_REACHED,
          maxCollaborators: 5,
          isMultiUser: true,
        });
      });

      it('should set read-only when collaborator count exceeds max capacity', async () => {
        // Arrange
        const userId = 'user123';
        const documentId = 'doc456';
        const collaboratorCount = 6;
        const mockMemoAccess = new InfoOutputData(true, true, true, 5);
        mockUtilService.getUserAccessToMemo.mockResolvedValue(mockMemoAccess);

        // Act
        const result = await service.authorize(userId, documentId, collaboratorCount);

        // Assert
        expect(result).toEqual({
          canRead: true,
          canUpdate: true,
          readOnly: true,
          readOnlyCode: ReadOnlyCode.ROOM_CAPACITY_REACHED,
          maxCollaborators: 5,
          isMultiUser: true,
        });
      });
    });

    describe('successful paths', () => {
      it('should allow full access when user has permissions and constraints are met', async () => {
        // Arrange
        const userId = 'user123';
        const documentId = 'doc456';
        const collaboratorCount = 2;
        const mockMemoAccess = new InfoOutputData(true, true, true, 5);
        mockUtilService.getUserAccessToMemo.mockResolvedValue(mockMemoAccess);

        // Act
        const result = await service.authorize(userId, documentId, collaboratorCount);

        // Assert
        expect(result).toEqual({
          canRead: true,
          canUpdate: true,
          readOnly: false,
          readOnlyCode: undefined,
          maxCollaborators: 5,
          isMultiUser: true,
        });
      });

      it('should allow access when collaborator count is below max', async () => {
        // Arrange
        const userId = 'user123';
        const documentId = 'doc456';
        const collaboratorCount = 3;
        const mockMemoAccess = new InfoOutputData(true, true, true, 10);
        mockUtilService.getUserAccessToMemo.mockResolvedValue(mockMemoAccess);

        // Act
        const result = await service.authorize(userId, documentId, collaboratorCount);

        // Assert
        expect(result).toEqual({
          canRead: true,
          canUpdate: true,
          readOnly: false,
          readOnlyCode: undefined,
          maxCollaborators: 10,
          isMultiUser: true,
        });
      });

      it('should allow single user when multi-user is allowed', async () => {
        // Arrange
        const userId = 'user123';
        const documentId = 'doc456';
        const collaboratorCount = 1;
        const mockMemoAccess = new InfoOutputData(true, true, true, 5);
        mockUtilService.getUserAccessToMemo.mockResolvedValue(mockMemoAccess);

        // Act
        const result = await service.authorize(userId, documentId, collaboratorCount);

        // Assert
        expect(result).toEqual({
          canRead: true,
          canUpdate: true,
          readOnly: false,
          readOnlyCode: undefined,
          maxCollaborators: 5,
          isMultiUser: true,
        });
      });

      it('should allow access with zero collaborators', async () => {
        // Arrange
        const userId = 'user123';
        const documentId = 'doc456';
        const collaboratorCount = 0;
        const mockMemoAccess = new InfoOutputData(true, true, true, 5);
        mockUtilService.getUserAccessToMemo.mockResolvedValue(mockMemoAccess);

        // Act
        const result = await service.authorize(userId, documentId, collaboratorCount);

        // Assert
        expect(result).toEqual({
          canRead: true,
          canUpdate: true,
          readOnly: false,
          readOnlyCode: undefined,
          maxCollaborators: 5,
          isMultiUser: true,
        });
      });
    });
  });
});
