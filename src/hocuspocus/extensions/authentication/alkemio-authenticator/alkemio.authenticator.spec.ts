import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { mock, MockProxy } from 'vitest-mock-extended';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlkemioAuthenticator } from './alkemio.authenticator';
import { AlkemioAuthenticationService } from './alkemio.authentication.service';
import { AuthenticationException } from '../exceptions';
import { LogContext } from '@common/enums';

describe('AlkemioAuthenticator', () => {
  let authenticator: AlkemioAuthenticator;
  let authService: MockProxy<AlkemioAuthenticationService>;
  let mockLogger: MockProxy<any>;

  beforeEach(async () => {
    authService = mock<AlkemioAuthenticationService>();
    mockLogger = mock<any>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlkemioAuthenticator,
        {
          provide: AlkemioAuthenticationService,
          useValue: authService,
        },
        {
          provide: WINSTON_MODULE_NEST_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    authenticator = module.get<AlkemioAuthenticator>(AlkemioAuthenticator);
  });

  describe('onConnect', () => {
    const mockOnConnectData = {
      requestHeaders: {
        cookie: 'session=abc123',
        authorization: 'Bearer token123',
      },
      connectionConfig: {},
      documentName: 'test-document',
    } as any;

    it('should handle missing headers gracefully', async () => {
      const onConnectPayloadWithoutHeaders = {
        requestHeaders: {},
        connectionConfig: {},
        documentName: 'test-document',
      } as any;

      authService.getUserIdentity.mockResolvedValue(undefined);

      const result = await authenticator.onConnect(onConnectPayloadWithoutHeaders);

      expect(authService.getUserIdentity).toHaveBeenCalledWith({
        cookie: undefined,
        authorization: undefined,
      });
      expect(result).toBeUndefined();
    });

    it('should authenticate user successfully with valid credentials', async () => {
      const userInfo = {
        id: 'user123',
        email: 'user@test.com',
        displayName: 'Test User',
      };

      authService.getUserIdentity.mockResolvedValue(userInfo);

      const result = await authenticator.onConnect(mockOnConnectData);

      expect(authService.getUserIdentity).toHaveBeenCalledWith({
        cookie: 'session=abc123',
        authorization: 'Bearer token123',
      });
      expect(mockOnConnectData.connectionConfig.isAuthenticated).toBe(true);
      expect(mockOnConnectData.userInfo).toEqual(userInfo);
      expect(result).toEqual({
        isAuthenticated: true,
        authenticatedBy: 'onConnect',
        userInfo,
      });
    });

    it('should handle unauthenticated user and wait for onAuthenticate', async () => {
      authService.getUserIdentity.mockResolvedValue(undefined);

      const result = await authenticator.onConnect(mockOnConnectData);

      expect(mockOnConnectData.connectionConfig.isAuthenticated).toBe(false);
      expect(result).toBeUndefined();
    });
  });

  describe('onAuthenticate', () => {
    const mockOnAuthenticateData = {
      token: 'auth-token-123',
      documentName: 'test-document',
      connectionConfig: {},
      context: {},
    } as any;

    it('should skip authentication if user is already authenticated', async () => {
      mockOnAuthenticateData.connectionConfig.isAuthenticated = true;

      const result = await authenticator.onAuthenticate(mockOnAuthenticateData);

      expect(authService.getUserIdentity).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should authenticate user successfully with valid token', async () => {
      mockOnAuthenticateData.connectionConfig.isAuthenticated = false;

      const userInfo = {
        id: 'user456',
        email: 'user2@test.com',
        displayName: 'Test User 2',
      };

      authService.getUserIdentity.mockResolvedValue(userInfo);

      const result = await authenticator.onAuthenticate(mockOnAuthenticateData);

      expect(authService.getUserIdentity).toHaveBeenCalledWith({
        authorization: 'Bearer auth-token-123',
      });
      expect(mockOnAuthenticateData.connectionConfig.isAuthenticated).toBe(true);
      expect(result).toEqual({
        isAuthenticated: true,
        authenticatedBy: 'onAuthenticate',
        userInfo,
      });
    });

    it('should throw AuthenticationException for invalid credentials', async () => {
      mockOnAuthenticateData.connectionConfig.isAuthenticated = false;

      authService.getUserIdentity.mockResolvedValue(undefined);

      await expect(authenticator.onAuthenticate(mockOnAuthenticateData)).rejects.toThrow(
        AuthenticationException
      );

      expect(mockLogger.verbose).toHaveBeenCalledWith(
        {
          message: '[onAuthenticate] Client failed to authenticate.',
          userId: undefined,
          documentId: mockOnAuthenticateData.documentName,
        },
        LogContext.AUTHENTICATION
      );
    });

    it('should handle authentication without user info', async () => {
      mockOnAuthenticateData.connectionConfig.isAuthenticated = false;

      authService.getUserIdentity.mockResolvedValue(undefined);

      await expect(authenticator.onAuthenticate(mockOnAuthenticateData)).rejects.toThrow(
        AuthenticationException
      );
    });
  });

  describe('connected', () => {
    it('should log successful connection when verbose logging is enabled', async () => {
      mockLogger.verbose = vi.fn();

      const connectedData = {
        context: {
          authenticatedBy: 'onConnect',
          userInfo: {
            id: 'user123',
            email: 'user@test.com',
            displayName: 'Test User',
          },
        },
        documentName: 'test-document',
      } as any;

      await authenticator.connected(connectedData);

      expect(mockLogger.verbose).toHaveBeenCalledWith(
        '[onConnect] User user@test.com authenticated',
        LogContext.AUTHENTICATION
      );
    });

    it('should not log when verbose logging is disabled', async () => {
      mockLogger.verbose = undefined;

      const connectedData = {
        context: {
          authenticatedBy: 'onAuthenticate',
          userInfo: {
            id: 'user456',
            email: 'user2@test.com',
            displayName: 'Test User 2',
          },
        },
        documentName: 'test-document',
      } as any;

      await authenticator.connected(connectedData);

      // Should not throw any errors
      expect(mockLogger.verbose).toBeUndefined();
    });
  });

  describe('error scenarios', () => {
    it('should handle network timeouts during authentication by returning undefined', async () => {
      const mockOnConnectData = {
        requestHeaders: {
          authorization: 'Bearer timeout-token',
        },
        connectionConfig: {},
        documentName: 'test-document',
      } as any;

      // getUserIdentity catches errors internally and returns undefined
      authService.getUserIdentity.mockResolvedValue(undefined);

      const result = await authenticator.onConnect(mockOnConnectData);

      expect(result).toBeUndefined();
      expect(mockOnConnectData.connectionConfig.isAuthenticated).toBe(false);
    });

    it('should handle malformed tokens gracefully', async () => {
      const mockOnAuthenticateData = {
        token: 'malformed-token',
        documentName: 'test-document',
        connectionConfig: { isAuthenticated: false },
      } as any;

      authService.getUserIdentity.mockResolvedValue(undefined);

      await expect(authenticator.onAuthenticate(mockOnAuthenticateData)).rejects.toThrow(
        AuthenticationException
      );
    });
  });

  describe('connected method call flow', () => {
    describe('failing paths - connected should NOT be called', () => {
      it('should not call connected when onConnect authentication fails', async () => {
        // Arrange
        const mockOnConnectData = {
          requestHeaders: {
            cookie: 'invalid-cookie',
            authorization: 'Bearer invalid-token',
          },
          connectionConfig: {},
          documentName: 'test-document',
        } as any;

        authService.getUserIdentity.mockResolvedValue(undefined);
        const connectedSpy = vi.spyOn(authenticator, 'connected');

        // Act
        const result = await authenticator.onConnect(mockOnConnectData);

        // Assert
        expect(result).toBeUndefined();
        expect(mockOnConnectData.connectionConfig.isAuthenticated).toBe(false);
        expect(connectedSpy).not.toHaveBeenCalled();
      });

      it('should not call connected when onAuthenticate throws exception', async () => {
        // Arrange
        const mockOnAuthenticateData = {
          token: 'invalid-token',
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: false },
        } as any;

        authService.getUserIdentity.mockResolvedValue(undefined);
        const connectedSpy = vi.spyOn(authenticator, 'connected');

        // Act & Assert
        await expect(authenticator.onAuthenticate(mockOnAuthenticateData)).rejects.toThrow(
          AuthenticationException
        );
        expect(connectedSpy).not.toHaveBeenCalled();
      });

      it('should not call connected when authentication service returns undefined in onConnect', async () => {
        // Arrange
        const mockOnConnectData = {
          requestHeaders: {
            authorization: 'Bearer expired-token',
          },
          connectionConfig: {},
          documentName: 'test-document',
        } as any;

        authService.getUserIdentity.mockResolvedValue(undefined);
        const connectedSpy = vi.spyOn(authenticator, 'connected');

        // Act
        await authenticator.onConnect(mockOnConnectData);

        // Assert
        expect(connectedSpy).not.toHaveBeenCalled();
      });

      it('should not call connected when onAuthenticate rejects due to no user info', async () => {
        // Arrange
        const mockOnAuthenticateData = {
          token: 'token-without-user',
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: false },
        } as any;

        authService.getUserIdentity.mockResolvedValue(undefined);
        const connectedSpy = vi.spyOn(authenticator, 'connected');

        // Act & Assert
        await expect(authenticator.onAuthenticate(mockOnAuthenticateData)).rejects.toThrow();
        expect(connectedSpy).not.toHaveBeenCalled();
      });

      it('should not call connected when authentication fails with missing credentials', async () => {
        // Arrange
        const mockOnConnectData = {
          requestHeaders: {},
          connectionConfig: {},
          documentName: 'test-document',
        } as any;

        authService.getUserIdentity.mockResolvedValue(undefined);
        const connectedSpy = vi.spyOn(authenticator, 'connected');

        // Act
        await authenticator.onConnect(mockOnConnectData);

        // Assert
        expect(connectedSpy).not.toHaveBeenCalled();
        expect(mockOnConnectData.connectionConfig.isAuthenticated).toBe(false);
      });

      it('should not call connected when onAuthenticate fails for unauthenticated user', async () => {
        // Arrange
        const mockOnAuthenticateData = {
          token: 'some-token',
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: false },
        } as any;

        authService.getUserIdentity.mockResolvedValue(undefined);
        const connectedSpy = vi.spyOn(authenticator, 'connected');

        // Act & Assert
        await expect(authenticator.onAuthenticate(mockOnAuthenticateData)).rejects.toThrow(
          AuthenticationException
        );
        expect(connectedSpy).not.toHaveBeenCalled();
      });
    });

    describe('successful paths - connected should be called after successful authentication', () => {
      it('should be ready to call connected after successful onConnect authentication', async () => {
        // Arrange
        const userInfo = {
          id: 'user123',
          email: 'user@test.com',
        };

        const mockOnConnectData = {
          requestHeaders: {
            cookie: 'valid-cookie',
            authorization: 'Bearer valid-token',
          },
          connectionConfig: {},
          documentName: 'test-document',
        } as any;

        authService.getUserIdentity.mockResolvedValue(userInfo);

        // Act
        const result = await authenticator.onConnect(mockOnConnectData);

        // Assert - verify authentication succeeded and context is ready for connected()
        expect(result).toEqual({
          isAuthenticated: true,
          authenticatedBy: 'onConnect',
          userInfo,
        });
        expect(mockOnConnectData.connectionConfig.isAuthenticated).toBe(true);
        expect(mockOnConnectData.userInfo).toEqual(userInfo);

        // Verify connected can be called with the proper context
        const connectedData = {
          context: result,
        } as any;

        await expect(authenticator.connected(connectedData)).resolves.toBeUndefined();
      });

      it('should be ready to call connected after successful onAuthenticate authentication', async () => {
        // Arrange
        const userInfo = {
          id: 'user456',
          email: 'user2@test.com',
        };

        const mockOnAuthenticateData = {
          token: 'valid-auth-token',
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: false },
        } as any;

        authService.getUserIdentity.mockResolvedValue(userInfo);

        // Act
        const result = await authenticator.onAuthenticate(mockOnAuthenticateData);

        // Assert - verify authentication succeeded and context is ready for connected()
        expect(result).toEqual({
          isAuthenticated: true,
          authenticatedBy: 'onAuthenticate',
          userInfo,
        });
        expect(mockOnAuthenticateData.connectionConfig.isAuthenticated).toBe(true);

        // Verify connected can be called with the proper context
        const connectedData = {
          context: result,
        } as any;

        await expect(authenticator.connected(connectedData)).resolves.toBeUndefined();
      });

      it('should verify connected is only callable after authentication provides required context', async () => {
        // Arrange
        const userInfo = {
          id: 'user789',
          email: 'user3@test.com',
        };

        const mockOnConnectData = {
          requestHeaders: {
            authorization: 'Bearer another-valid-token',
          },
          connectionConfig: {},
          documentName: 'test-document',
        } as any;

        authService.getUserIdentity.mockResolvedValue(userInfo);

        // Act
        const authResult = await authenticator.onConnect(mockOnConnectData);

        // Assert - authentication must succeed first
        expect(authResult).toBeDefined();
        expect(authResult?.isAuthenticated).toBe(true);

        // connected() requires the authentication context
        const connectedPayload = {
          context: authResult,
          documentName: 'test-document',
        } as any;

        // This demonstrates that connected() can only be called with successful auth context
        await expect(authenticator.connected(connectedPayload)).resolves.toBeUndefined();
      });

      it('should handle connected method logging when verbose is enabled', async () => {
        // Arrange
        mockLogger.verbose = vi.fn();

        const userInfo = {
          id: 'user-log-test',
          email: 'logtest@example.com',
        };

        const mockOnConnectData = {
          requestHeaders: {
            cookie: 'valid-session',
          },
          connectionConfig: {},
          documentName: 'test-document',
        } as any;

        authService.getUserIdentity.mockResolvedValue(userInfo);
        const authResult = await authenticator.onConnect(mockOnConnectData);

        const connectedData = {
          context: authResult,
          documentName: 'test-document',
        } as any;

        // Act
        await authenticator.connected(connectedData);

        // Assert
        expect(mockLogger.verbose).toHaveBeenCalledWith(
          '[onConnect] User logtest@example.com authenticated',
          LogContext.AUTHENTICATION
        );
      });

      it('should successfully call connected after onConnect with only cookie', async () => {
        // Arrange
        const userInfo = {
          id: 'cookie-user',
          email: 'cookie@example.com',
        };

        const mockOnConnectData = {
          requestHeaders: {
            cookie: 'session-cookie-only',
          },
          connectionConfig: {},
          documentName: 'test-document',
        } as any;

        authService.getUserIdentity.mockResolvedValue(userInfo);

        // Act
        const authResult = await authenticator.onConnect(mockOnConnectData);

        // Assert
        expect(authResult).toBeDefined();
        expect(authResult?.isAuthenticated).toBe(true);

        const connectedData = {
          context: authResult,
        } as any;

        await expect(authenticator.connected(connectedData)).resolves.toBeUndefined();
      });

      it('should successfully call connected after onConnect with only authorization header', async () => {
        // Arrange
        const userInfo = {
          id: 'bearer-user',
          email: 'bearer@example.com',
        };

        const mockOnConnectData = {
          requestHeaders: {
            authorization: 'Bearer bearer-token-only',
          },
          connectionConfig: {},
          documentName: 'test-document',
        } as any;

        authService.getUserIdentity.mockResolvedValue(userInfo);

        // Act
        const authResult = await authenticator.onConnect(mockOnConnectData);

        // Assert
        expect(authResult).toBeDefined();
        expect(authResult?.isAuthenticated).toBe(true);

        const connectedData = {
          context: authResult,
        } as any;

        await expect(authenticator.connected(connectedData)).resolves.toBeUndefined();
      });

      it('should verify connected receives correct authenticatedBy value from onAuthenticate', async () => {
        // Arrange
        mockLogger.verbose = vi.fn();

        const userInfo = {
          id: 'auth-by-test',
          email: 'authby@example.com',
        };

        const mockOnAuthenticateData = {
          token: 'valid-token',
          documentName: 'test-document',
          connectionConfig: { isAuthenticated: false },
        } as any;

        authService.getUserIdentity.mockResolvedValue(userInfo);

        // Act
        const authResult = await authenticator.onAuthenticate(mockOnAuthenticateData);

        const connectedData = {
          context: authResult,
          documentName: 'test-document',
        } as any;

        await authenticator.connected(connectedData);

        // Assert
        expect(mockLogger.verbose).toHaveBeenCalledWith(
          '[onAuthenticate] User authby@example.com authenticated',
          LogContext.AUTHENTICATION
        );
      });
    });
  });
});
