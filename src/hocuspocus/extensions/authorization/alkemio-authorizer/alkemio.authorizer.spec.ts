import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { mock, MockProxy } from 'vitest-mock-extended';
import { describe, it, expect, beforeEach } from 'vitest';
import { AlkemioAuthorizer } from './alkemio.authorizer';
import { AlkemioAuthorizationService } from './alkemio.authorization.service';
import { HocuspocusConnectionService } from '@src/hocuspocus/services';
import { ForbiddenException } from '../../authentication/exceptions';
import { AuthorizationResult } from '../types';
import { Hocuspocus } from '@hocuspocus/server';

describe('AlkemioAuthorizer', () => {
  let authorizer: AlkemioAuthorizer;
  let authorizationService: MockProxy<AlkemioAuthorizationService>;
  let connectionService: MockProxy<HocuspocusConnectionService>;
  let mockLogger: MockProxy<any>;
  let mockHocuspocus: MockProxy<Hocuspocus>;

  beforeEach(async () => {
    authorizationService = mock<AlkemioAuthorizationService>();
    connectionService = mock<HocuspocusConnectionService>();
    mockLogger = mock<any>();
    mockHocuspocus = mock<Hocuspocus>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlkemioAuthorizer,
        {
          provide: AlkemioAuthorizationService,
          useValue: authorizationService,
        },
        {
          provide: HocuspocusConnectionService,
          useValue: connectionService,
        },
        {
          provide: WINSTON_MODULE_NEST_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    authorizer = module.get<AlkemioAuthorizer>(AlkemioAuthorizer);
  });

  describe('onConnect', () => {
    const mockUserInfo = {
      id: 'user123',
      email: 'user@test.com',
      displayName: 'Test User',
    };

    const mockOnConnectData = {
      documentName: 'test-document',
      connectionConfig: { isAuthenticated: true },
      userInfo: mockUserInfo,
      instance: mockHocuspocus,
    } as any;

    it('should reject unauthenticated users', async () => {
      const unauthenticatedData = {
        ...mockOnConnectData,
        connectionConfig: { isAuthenticated: false },
      };

      await expect(authorizer.onConnect(unauthenticatedData)).rejects.toBeUndefined();
      expect(authorizationService.authorize).not.toHaveBeenCalled();
    });
    it('should reject when userInfo is missing', async () => {
      const dataWithoutUser = {
        ...mockOnConnectData,
        userInfo: undefined,
      };

      await expect(authorizer.onConnect(dataWithoutUser)).rejects.toBeUndefined();
      expect(authorizationService.authorize).not.toHaveBeenCalled();
    });
    it('should handle forbidden access', async () => {
      const forbiddenResult: AuthorizationResult = {
        canRead: false,
      } as any;

      connectionService.getCollaboratorConnections.mockReturnValue([]);
      authorizationService.authorize.mockResolvedValue(forbiddenResult);

      await expect(authorizer.onConnect(mockOnConnectData)).rejects.toThrowError(
        ForbiddenException
      );
    });
    it('should authorize user with read-only access', async () => {
      const authResult: AuthorizationResult = {
        canRead: true,
        canUpdate: false,
        readOnly: true,
      } as any;

      connectionService.getCollaboratorConnections.mockReturnValue([]);
      authorizationService.authorize.mockResolvedValue(authResult);

      const result = await authorizer.onConnect(mockOnConnectData);

      expect(result).toEqual({
        ...authResult,
        userInfo: mockUserInfo,
        authorizedBy: 'onConnect',
      });
    });
    it('should authorize user with read-write access successfully', async () => {
      const authResult: AuthorizationResult = {
        canRead: true,
        canUpdate: true,
        readOnly: false,
        maxCollaborators: 2,
        isMultiUser: true,
      };

      authorizationService.authorize.mockResolvedValue(authResult);
      connectionService.getCollaboratorConnections.mockReturnValue([]);

      const result = await authorizer.onConnect(mockOnConnectData);

      expect(authorizationService.authorize).toHaveBeenCalledWith(
        mockUserInfo.id,
        'test-document',
        0
      );
      expect(result).toEqual({
        ...authResult,
        userInfo: mockUserInfo,
        authorizedBy: 'onConnect',
      });
    });
  });

  describe('onAuthenticate', () => {
    const mockUserInfo = {
      id: 'user456',
      email: 'user2@test.com',
      displayName: 'Test User 2',
    };

    const mockOnAuthenticateData = {
      documentName: 'test-document',
      connectionConfig: { isAuthenticated: true },
      context: {
        userInfo: mockUserInfo,
      },
      instance: mockHocuspocus,
    } as any;

    it('should authorize authenticated user successfully', async () => {
      const authResult: AuthorizationResult = {
        canRead: true,
        canUpdate: true,
        readOnly: false,
      } as any;

      connectionService.getCollaboratorConnections.mockReturnValue([]);
      authorizationService.authorize.mockResolvedValue(authResult);

      const result = await authorizer.onAuthenticate(mockOnAuthenticateData);

      expect(authorizationService.authorize).toHaveBeenCalledWith(
        mockUserInfo.id,
        'test-document',
        0
      );
      expect(result).toEqual({
        ...authResult,
        userInfo: mockUserInfo,
        authorizedBy: 'onAuthenticate',
      });
    });

    it('should reject unauthenticated users', async () => {
      const unauthenticatedData = {
        ...mockOnAuthenticateData,
        connectionConfig: { isAuthenticated: false },
      };

      await expect(authorizer.onAuthenticate(unauthenticatedData)).rejects.toBeUndefined();
      expect(authorizationService.authorize).not.toHaveBeenCalled();
    });

    it('should handle missing context userInfo', async () => {
      const dataWithoutUser = {
        ...mockOnAuthenticateData,
        context: {},
      };

      await expect(authorizer.onAuthenticate(dataWithoutUser)).rejects.toBeUndefined();
      expect(authorizationService.authorize).not.toHaveBeenCalled();
    });
  });

  describe('authorizeDocumentAccess private method', () => {
    it('should call authorization service with correct parameters', async () => {
      const userId = 'user789';
      const documentId = 'document123';
      const authResult: AuthorizationResult = {
        canRead: true,
        canUpdate: false,
        readOnly: true,
      } as any;

      connectionService.getCollaboratorConnections.mockReturnValue([]);
      authorizationService.authorize.mockResolvedValue(authResult);

      // Access private method for testing
      const result = await (authorizer as any).authorizeDocumentAccess(
        userId,
        documentId,
        mockHocuspocus
      );

      expect(authorizationService.authorize).toHaveBeenCalledWith(userId, documentId, 0);
      expect(result).toEqual(authResult);
    });

    it('should handle authorization failures gracefully', async () => {
      const userId = 'user789';
      const documentId = 'restricted-document';
      const authError = new ForbiddenException('Access denied', 'authorization' as any);

      connectionService.getCollaboratorConnections.mockReturnValue([]);
      authorizationService.authorize.mockRejectedValue(authError);

      await expect(
        (authorizer as any).authorizeDocumentAccess(userId, documentId, mockHocuspocus)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('integration with connection service', () => {
    it('should work with connection service for access control', async () => {
      const mockConnections = [
        { id: 'conn1', user: 'user1', readOnly: false },
        { id: 'conn2', user: 'user2', readOnly: true },
      ];

      connectionService.getConnections.mockReturnValue(mockConnections);
      connectionService.getReadOnlyConnections.mockReturnValue([mockConnections[1]]);
      connectionService.getCollaboratorConnections.mockReturnValue([mockConnections[0]]);

      // This tests that the authorizer can work with connection service
      expect(connectionService.getConnections(mockHocuspocus, 'test-doc')).toEqual(mockConnections);
      expect(connectionService.getReadOnlyConnections(mockHocuspocus, 'test-doc')).toHaveLength(1);
      expect(connectionService.getCollaboratorConnections(mockHocuspocus, 'test-doc')).toHaveLength(
        1
      );
    });
  });

  describe('extension configuration', () => {
    it('should have correct extension name', () => {
      expect(authorizer.extensionName).toBe('AlkemioAuthorizer');
    });

    it('should inherit from AbstractAuthorizer', () => {
      expect(authorizer).toHaveProperty('onConnect');
      expect(authorizer).toHaveProperty('onAuthenticate');
      expect(typeof authorizer.onConnect).toBe('function');
      expect(typeof authorizer.onAuthenticate).toBe('function');
    });
  });

  describe('error handling scenarios', () => {
    it('should handle authorization service errors by propagating them', async () => {
      connectionService.getCollaboratorConnections.mockReturnValue([]);

      const mockOnConnectData = {
        documentName: 'test-document',
        connectionConfig: { isAuthenticated: true },
        userInfo: { id: 'user123', email: 'user@test.com', displayName: 'Test User' },
        instance: mockHocuspocus,
      } as any;

      // authorizationService.authorize does not throw normally, but if the underlying utilService does
      const serviceError = new Error('Authorization service unavailable');
      authorizationService.authorize.mockRejectedValue(serviceError);

      await expect(authorizer.onConnect(mockOnConnectData)).rejects.toThrow(
        'Authorization service unavailable'
      );
    });
  });
});
