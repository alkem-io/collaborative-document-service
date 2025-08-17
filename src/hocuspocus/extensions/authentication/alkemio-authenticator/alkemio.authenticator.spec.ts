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
});
