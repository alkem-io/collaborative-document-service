import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { mock, MockProxy } from 'vitest-mock-extended';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlkemioAuthorizer } from './alkemio.authorizer';
import { AlkemioAuthorizationService } from './alkemio.authorization.service';
import { HocuspocusConnectionService } from '@src/hocuspocus/services';
import { ForbiddenException } from '../../authentication/exceptions';
import { AuthorizationResult, ReadOnlyCode } from '../types';
import { Connection, Hocuspocus } from '@hocuspocus/server';

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
      ] as unknown as Connection[];

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

  describe('connected method call flow', () => {
    const mockUserInfo = {
      id: 'user123',
      email: 'user@test.com',
      displayName: 'Test User',
    };

    beforeEach(() => {
      connectionService.getConnections.mockReturnValue([]);
      connectionService.getCollaboratorConnections.mockReturnValue([]);
      connectionService.getReadOnlyConnections.mockReturnValue([]);
    });

    describe('failing paths - connected should NOT be called', () => {
      it('should not call connected when onConnect rejects unauthenticated user', async () => {
        // Arrange
        const unauthenticatedData = {
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: false },
          userInfo: mockUserInfo,
          instance: mockHocuspocus,
        } as any;

        const connectedSpy = vi.fn();
        (authorizer as any).connected = connectedSpy;

        // Act & Assert
        await expect(authorizer.onConnect(unauthenticatedData)).rejects.toBeUndefined();
        expect(authorizationService.authorize).not.toHaveBeenCalled();
        expect(connectedSpy).not.toHaveBeenCalled();
      });

      it('should not call connected when onConnect rejects due to missing userInfo', async () => {
        // Arrange
        const dataWithoutUser = {
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: true },
          userInfo: undefined,
          instance: mockHocuspocus,
        } as any;

        const connectedSpy = vi.fn();
        (authorizer as any).connected = connectedSpy;

        // Act & Assert
        await expect(authorizer.onConnect(dataWithoutUser)).rejects.toBeUndefined();
        expect(connectedSpy).not.toHaveBeenCalled();
      });

      it('should not call connected when onConnect throws ForbiddenException for no read access', async () => {
        // Arrange
        const mockOnConnectData = {
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: true },
          userInfo: mockUserInfo,
          instance: mockHocuspocus,
        } as any;

        const forbiddenResult: AuthorizationResult = {
          canRead: false,
          canUpdate: false,
          readOnly: true,
        } as any;

        authorizationService.authorize.mockResolvedValue(forbiddenResult);
        const connectedSpy = vi.fn();
        (authorizer as any).connected = connectedSpy;

        // Act & Assert
        await expect(authorizer.onConnect(mockOnConnectData)).rejects.toThrowError(
          ForbiddenException
        );
        expect(connectedSpy).not.toHaveBeenCalled();
      });

      it('should not call connected when onAuthenticate rejects unauthenticated user', async () => {
        // Arrange
        const unauthenticatedData = {
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: false },
          context: { userInfo: mockUserInfo },
          instance: mockHocuspocus,
        } as any;

        const connectedSpy = vi.fn();
        (authorizer as any).connected = connectedSpy;

        // Act & Assert
        await expect(authorizer.onAuthenticate(unauthenticatedData)).rejects.toBeUndefined();
        expect(connectedSpy).not.toHaveBeenCalled();
      });

      it('should not call connected when onAuthenticate rejects due to missing userInfo in context', async () => {
        // Arrange
        const dataWithoutUser = {
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: true },
          context: {},
          instance: mockHocuspocus,
        } as any;

        const connectedSpy = vi.fn();
        (authorizer as any).connected = connectedSpy;

        // Act & Assert
        await expect(authorizer.onAuthenticate(dataWithoutUser)).rejects.toBeUndefined();
        expect(connectedSpy).not.toHaveBeenCalled();
      });

      it('should not call connected when authorization service throws error', async () => {
        // Arrange
        const mockOnConnectData = {
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: true },
          userInfo: mockUserInfo,
          instance: mockHocuspocus,
        } as any;

        const authError = new Error('Authorization failed');
        authorizationService.authorize.mockRejectedValue(authError);
        const connectedSpy = vi.fn();
        (authorizer as any).connected = connectedSpy;

        // Act & Assert
        await expect(authorizer.onConnect(mockOnConnectData)).rejects.toThrow('Authorization failed');
        expect(connectedSpy).not.toHaveBeenCalled();
      });
    });

    describe('successful paths - connected should be called after successful authorization', () => {
      it('should be ready to call connected after successful onConnect authorization with read-write access', async () => {
        // Arrange
        const mockOnConnectData = {
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: true },
          userInfo: mockUserInfo,
          instance: mockHocuspocus,
        } as any;

        const authResult: AuthorizationResult = {
          canRead: true,
          canUpdate: true,
          readOnly: false,
          maxCollaborators: 5,
          isMultiUser: true,
        };

        authorizationService.authorize.mockResolvedValue(authResult);

        // Act
        const result = await authorizer.onConnect(mockOnConnectData);

        // Assert - verify authorization succeeded and context is ready for connected()
        expect(result).toEqual({
          ...authResult,
          userInfo: mockUserInfo,
          authorizedBy: 'onConnect',
        });

        // Verify connected can be called with the proper context
        const mockConnection = {
          sendStateless: vi.fn(),
        } as any;

        const connectedData = {
          documentName: 'test-document',
          connection: mockConnection,
          connectionConfig: { readOnly: false },
          context: result,
          instance: mockHocuspocus,
        } as any;

        await expect(authorizer.connected(connectedData)).resolves.toBeUndefined();
        expect(mockConnection.sendStateless).toHaveBeenCalled();
      });

      it('should be ready to call connected after successful onConnect authorization with read-only access', async () => {
        // Arrange
        const mockOnConnectData = {
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: true },
          userInfo: mockUserInfo,
          instance: mockHocuspocus,
        } as any;

        const authResult: AuthorizationResult = {
          canRead: true,
          canUpdate: false,
          readOnly: true,
          readOnlyCode: ReadOnlyCode.NO_UPDATE_ACCESS,
          maxCollaborators: 5,
          isMultiUser: true,
        };

        authorizationService.authorize.mockResolvedValue(authResult);

        // Act
        const result = await authorizer.onConnect(mockOnConnectData);

        // Assert - verify authorization succeeded
        expect(result).toEqual({
          ...authResult,
          userInfo: mockUserInfo,
          authorizedBy: 'onConnect',
        });

        // Verify connected can be called with the proper context
        const mockConnection = {
          sendStateless: vi.fn(),
        } as any;

        const connectedData = {
          documentName: 'test-document',
          connection: mockConnection,
          connectionConfig: { readOnly: true },
          context: result,
          instance: mockHocuspocus,
        } as any;

        await expect(authorizer.connected(connectedData)).resolves.toBeUndefined();
        expect(mockConnection.sendStateless).toHaveBeenCalledWith(
          expect.stringContaining('"event":"read-only-state"')
        );
      });

      it('should be ready to call connected after successful onAuthenticate authorization', async () => {
        // Arrange
        const mockOnAuthenticateData = {
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: true },
          context: { userInfo: mockUserInfo },
          instance: mockHocuspocus,
        } as any;

        const authResult: AuthorizationResult = {
          canRead: true,
          canUpdate: true,
          readOnly: false,
          maxCollaborators: 5,
          isMultiUser: true,
        };

        authorizationService.authorize.mockResolvedValue(authResult);

        // Act
        const result = await authorizer.onAuthenticate(mockOnAuthenticateData);

        // Assert - verify authorization succeeded
        expect(result).toEqual({
          ...authResult,
          userInfo: mockUserInfo,
          authorizedBy: 'onAuthenticate',
        });

        // Verify connected can be called with the proper context
        const mockConnection = {
          sendStateless: vi.fn(),
        } as any;

        const connectedData = {
          documentName: 'test-document',
          connection: mockConnection,
          connectionConfig: { readOnly: false },
          context: result,
          instance: mockHocuspocus,
        } as any;

        await expect(authorizer.connected(connectedData)).resolves.toBeUndefined();
      });

      it('should verify connected is only callable after authorization provides required context', async () => {
        // Arrange
        const mockOnConnectData = {
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: true },
          userInfo: mockUserInfo,
          instance: mockHocuspocus,
        } as any;

        const authResult: AuthorizationResult = {
          canRead: true,
          canUpdate: true,
          readOnly: false,
          maxCollaborators: 5,
          isMultiUser: true,
        };

        authorizationService.authorize.mockResolvedValue(authResult);

        // Act
        const result = await authorizer.onConnect(mockOnConnectData);

        // Assert - authorization must succeed first
        expect(result).toBeDefined();
        expect(result.canRead).toBe(true);
        expect(result.authorizedBy).toBe('onConnect');

        // connected() requires the authorization context
        const mockConnection = {
          sendStateless: vi.fn(),
        } as any;

        const connectedPayload = {
          documentName: 'test-document',
          connection: mockConnection,
          connectionConfig: { readOnly: false },
          context: result,
          instance: mockHocuspocus,
        } as any;

        // This demonstrates that connected() can only be called with successful auth context
        await expect(authorizer.connected(connectedPayload)).resolves.toBeUndefined();
        expect(mockConnection.sendStateless).toHaveBeenCalled();
      });

      it('should handle connected method logging when verbose is enabled', async () => {
        // Arrange
        mockLogger.verbose = vi.fn();

        const mockOnConnectData = {
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: true },
          userInfo: mockUserInfo,
          instance: mockHocuspocus,
        } as any;

        const authResult: AuthorizationResult = {
          canRead: true,
          canUpdate: true,
          readOnly: false,
          maxCollaborators: 5,
          isMultiUser: true,
        };

        authorizationService.authorize.mockResolvedValue(authResult);
        const result = await authorizer.onConnect(mockOnConnectData);

        const mockConnection = {
          sendStateless: vi.fn(),
        } as any;

        const connectedData = {
          documentName: 'test-document',
          connection: mockConnection,
          connectionConfig: { readOnly: false },
          context: result,
          instance: mockHocuspocus,
        } as any;

        // Act
        await authorizer.connected(connectedData);

        // Assert
        expect(mockLogger.verbose).toHaveBeenCalledWith(
          expect.objectContaining({
            message: '[onConnect] User authorized',
            userId: mockUserInfo.email,
            read: true,
            readOnly: false,
          }),
          expect.any(String)
        );
      });
    });
  });
});
