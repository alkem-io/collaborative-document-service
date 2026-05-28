import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { mock, MockProxy } from 'vitest-mock-extended';
import { describe, it, expect, beforeEach } from 'vitest';
import { LogContext } from '@common/enums';
import { AlkemioAuthenticator } from './alkemio.authenticator';
import { AuthenticationException } from '../exceptions';

/**
 * Identity now comes from the gateway via `X-Alkemio-Actor-Id` (stamped by
 * Traefik's `alkemio-resolve` forwardAuth after stripping client-supplied
 * X-Alkemio-* headers). These tests cover the trust-the-header contract:
 *
 *   - onConnect: authenticated iff the header arrives as a non-empty string.
 *   - onAuthenticate: fail-closed — no token validation here.
 *   - connected: logs the resolved actor identity.
 */
describe('AlkemioAuthenticator', () => {
  let authenticator: AlkemioAuthenticator;
  let mockLogger: MockProxy<any>;

  beforeEach(async () => {
    mockLogger = mock<any>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlkemioAuthenticator,
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: mockLogger },
      ],
    }).compile();
    authenticator = module.get<AlkemioAuthenticator>(AlkemioAuthenticator);
  });

  describe('onConnect', () => {
    it('authenticates when X-Alkemio-Actor-Id header is present', async () => {
      const data = {
        requestHeaders: { 'x-alkemio-actor-id': 'actor-uuid-123' },
        connectionConfig: {},
        documentName: 'doc1',
      } as any;

      const result = await authenticator.onConnect(data);

      expect(data.connectionConfig.isAuthenticated).toBe(true);
      expect(data.userInfo).toEqual({ id: 'actor-uuid-123' });
      expect(result).toEqual({
        isAuthenticated: true,
        authenticatedBy: 'onConnect',
        userInfo: { id: 'actor-uuid-123' },
      });
    });

    it('does not add legacy fields (e.g. email) to userInfo', async () => {
      const data = {
        requestHeaders: { 'x-alkemio-actor-id': 'actor-1' },
        connectionConfig: {},
        documentName: 'doc1',
      } as any;

      await authenticator.onConnect(data);

      expect(Object.keys(data.userInfo)).toEqual(['id']);
    });

    it('treats request as unauthenticated when actor header is absent', async () => {
      const data = {
        requestHeaders: { cookie: 'irrelevant=value' },
        connectionConfig: {},
        documentName: 'doc1',
      } as any;

      const result = await authenticator.onConnect(data);

      expect(data.connectionConfig.isAuthenticated).toBe(false);
      expect(data.userInfo).toBeUndefined();
      expect(result).toBeUndefined();
    });

    it('treats empty-string actor header as absent', async () => {
      const data = {
        requestHeaders: { 'x-alkemio-actor-id': '' },
        connectionConfig: {},
        documentName: 'doc1',
      } as any;

      const result = await authenticator.onConnect(data);

      expect(data.connectionConfig.isAuthenticated).toBe(false);
      expect(result).toBeUndefined();
    });

    it('treats missing requestHeaders as absent', async () => {
      const data = {
        requestHeaders: undefined,
        connectionConfig: {},
        documentName: 'doc1',
      } as any;

      const result = await authenticator.onConnect(data);

      expect(data.connectionConfig.isAuthenticated).toBe(false);
      expect(result).toBeUndefined();
    });

    it('uses the first value when the header arrives as an array', async () => {
      const data = {
        requestHeaders: { 'x-alkemio-actor-id': ['first', 'second'] },
        connectionConfig: {},
        documentName: 'doc1',
      } as any;

      const result = await authenticator.onConnect(data);

      expect(data.userInfo).toEqual({ id: 'first' });
      expect(result).toEqual({
        isAuthenticated: true,
        authenticatedBy: 'onConnect',
        userInfo: { id: 'first' },
      });
    });

    it('treats an array with empty first value as absent', async () => {
      const data = {
        requestHeaders: { 'x-alkemio-actor-id': ['', 'second'] },
        connectionConfig: {},
        documentName: 'doc1',
      } as any;

      const result = await authenticator.onConnect(data);

      expect(data.connectionConfig.isAuthenticated).toBe(false);
      expect(result).toBeUndefined();
    });

    it('treats an empty array as absent', async () => {
      const data = {
        requestHeaders: { 'x-alkemio-actor-id': [] as string[] },
        connectionConfig: {},
        documentName: 'doc1',
      } as any;

      const result = await authenticator.onConnect(data);

      expect(data.connectionConfig.isAuthenticated).toBe(false);
      expect(result).toBeUndefined();
    });

    it('is case-sensitive on the lowercase header name (Node normalizes to lowercase)', async () => {
      // Node's HTTP layer lowercases header names before delivery. A capitalized
      // key in the bag means the gateway header did NOT arrive at the lowercase
      // key — authenticator must not match it.
      const data = {
        requestHeaders: { 'X-Alkemio-Actor-Id': 'actor-uuid-123' },
        connectionConfig: {},
        documentName: 'doc1',
      } as any;

      const result = await authenticator.onConnect(data);

      expect(data.connectionConfig.isAuthenticated).toBe(false);
      expect(result).toBeUndefined();
    });

    it('preserves other connectionConfig fields while flipping isAuthenticated', async () => {
      const data = {
        requestHeaders: { 'x-alkemio-actor-id': 'actor-1' },
        connectionConfig: { someOtherFlag: true, readOnly: false },
        documentName: 'doc1',
      } as any;

      await authenticator.onConnect(data);

      expect(data.connectionConfig).toEqual({
        someOtherFlag: true,
        readOnly: false,
        isAuthenticated: true,
      });
    });

    it('ignores other headers (e.g. authorization) — gateway header is the only signal', async () => {
      const data = {
        requestHeaders: {
          authorization: 'Bearer some.jwt.token',
          cookie: 'session=abc',
        },
        connectionConfig: {},
        documentName: 'doc1',
      } as any;

      const result = await authenticator.onConnect(data);

      expect(data.connectionConfig.isAuthenticated).toBe(false);
      expect(result).toBeUndefined();
    });
  });

  describe('onAuthenticate', () => {
    it('is a no-op when the connection is already authenticated', async () => {
      const data = {
        connectionConfig: { isAuthenticated: true },
        documentName: 'doc1',
        token: 'irrelevant',
      } as any;

      const result = await authenticator.onAuthenticate(data);

      expect(result).toBeUndefined();
      expect(mockLogger.verbose).not.toHaveBeenCalled();
    });

    it('throws AuthenticationException when the gateway did not authenticate', async () => {
      const data = {
        connectionConfig: { isAuthenticated: false },
        documentName: 'doc1',
        token: 'irrelevant',
      } as any;

      await expect(authenticator.onAuthenticate(data)).rejects.toBeInstanceOf(
        AuthenticationException
      );
    });

    it('attaches documentId and AUTHENTICATION context to the exception', async () => {
      const data = {
        connectionConfig: { isAuthenticated: false },
        documentName: 'doc-xyz',
      } as any;

      await expect(authenticator.onAuthenticate(data)).rejects.toMatchObject({
        message: 'User is not authenticated.',
        context: LogContext.AUTHENTICATION,
        details: { documentId: 'doc-xyz' },
      });
    });

    it('logs a denial message with the documentId before throwing', async () => {
      const data = {
        connectionConfig: { isAuthenticated: false },
        documentName: 'doc-xyz',
      } as any;

      await expect(authenticator.onAuthenticate(data)).rejects.toBeInstanceOf(
        AuthenticationException
      );

      expect(mockLogger.verbose).toHaveBeenCalledWith(
        {
          message:
            '[onAuthenticate] No X-Alkemio-Actor-Id from gateway and no fallback path — denying.',
          documentId: 'doc-xyz',
        },
        LogContext.AUTHENTICATION
      );
    });

    it('still throws when verbose logging is disabled (optional chain safe)', async () => {
      mockLogger.verbose = undefined;
      const data = {
        connectionConfig: { isAuthenticated: false },
        documentName: 'doc-xyz',
      } as any;

      await expect(authenticator.onAuthenticate(data)).rejects.toBeInstanceOf(
        AuthenticationException
      );
    });

    it('ignores any provided token — no token validation happens here', async () => {
      const data = {
        connectionConfig: { isAuthenticated: false },
        documentName: 'doc1',
        token: 'looks.like.a.jwt',
      } as any;

      await expect(authenticator.onAuthenticate(data)).rejects.toBeInstanceOf(
        AuthenticationException
      );
    });
  });

  describe('connected', () => {
    it('logs the authenticated actor id with the onConnect tag', async () => {
      const data = {
        context: {
          authenticatedBy: 'onConnect',
          userInfo: { id: 'actor-uuid-123' },
        },
      } as any;

      await authenticator.connected(data);

      expect(mockLogger.verbose).toHaveBeenCalledWith(
        '[onConnect] Actor actor-uuid-123 authenticated',
        LogContext.AUTHENTICATION
      );
    });

    it('reflects the authenticatedBy tag in the log line', async () => {
      const data = {
        context: {
          authenticatedBy: 'onAuthenticate',
          userInfo: { id: 'actor-9' },
        },
      } as any;

      await authenticator.connected(data);

      expect(mockLogger.verbose).toHaveBeenCalledWith(
        '[onAuthenticate] Actor actor-9 authenticated',
        LogContext.AUTHENTICATION
      );
    });

    it('does not log and does not throw when verbose is disabled', async () => {
      mockLogger.verbose = undefined;
      const data = {
        context: {
          authenticatedBy: 'onConnect',
          userInfo: { id: 'actor-uuid-123' },
        },
      } as any;

      await expect(authenticator.connected(data)).resolves.toBeUndefined();
    });

    it('resolves to undefined', async () => {
      const data = {
        context: {
          authenticatedBy: 'onConnect',
          userInfo: { id: 'actor-uuid-123' },
        },
      } as any;

      await expect(authenticator.connected(data)).resolves.toBeUndefined();
    });
  });
});
