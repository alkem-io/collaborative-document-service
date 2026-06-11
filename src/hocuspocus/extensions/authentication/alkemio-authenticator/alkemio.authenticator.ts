import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { connectedPayload, onAuthenticatePayload, onConnectPayload } from '@hocuspocus/server';
import { LogContext } from '@common/enums';
import { UserInfo } from '@src/services/integration/types';
import { onConnectSharedData } from '../../types';
import { AbstractAuthenticator } from '../abstract.authenticator';
import { AuthenticationContext, WithAuthenticationContext } from '../types';
import { AuthenticationException } from '../exceptions';

const HEADER_ACTOR_ID_LOWER = 'x-alkemio-actor-id';

/**
 * Identity is established at the gateway by Traefik's `alkemio-resolve`
 * forwardAuth middleware (alkemio-server's `/api/auth/resolve`). The gateway
 * stamps `X-Alkemio-Actor-Id` on the websocket-upgrade request after
 * validating the request's cookie session OR Hydra-issued bearer.
 *
 * `strip-client-alkemio-headers` runs before `alkemio-resolve`, so any
 * client-supplied X-Alkemio-* is blanked before resolve overwrites it. The
 * header that arrives here is server-trusted.
 *
 * No token validation in hocuspocus — single source of truth lives in
 * alkemio-server. If the header is absent the request is treated as
 * unauthenticated.
 */
@Injectable()
export class AlkemioAuthenticator extends AbstractAuthenticator {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: WinstonLogger
  ) {
    super(AlkemioAuthenticator.name);
  }

  /**
   * Called once when a client is connecting. The returned object becomes
   * the `context` field on every subsequent hook payload.
   */
  async onConnect(
    data: onConnectPayload & onConnectSharedData
  ): Promise<AuthenticationContext | void> {
    const actorId = extractActorIdHeader(data.requestHeaders);

    if (!actorId) {
      // No gateway-stamped identity. Hocuspocus will then call onAuthenticate
      // when the client sends an Auth message — we fail closed there.
      data.connectionConfig.isAuthenticated = false;
      this.logger.verbose?.(
        {
          message:
            '[onConnect] Anonymous connection — no X-Alkemio-Actor-Id from gateway. Awaiting Auth message or close.',
          documentId: data.documentName,
        },
        LogContext.AUTHENTICATION
      );
      return Promise.resolve();
    }

    const userInfo: UserInfo = { id: actorId };
    data.connectionConfig.isAuthenticated = true;
    data.userInfo = userInfo;
    this.logger.verbose?.(
      {
        message: '[onConnect] Actor authenticated via gateway header',
        userId: actorId,
        documentId: data.documentName,
      },
      LogContext.AUTHENTICATION
    );
    return {
      isAuthenticated: true,
      authenticatedBy: 'onConnect',
      userInfo,
    };
  }

  /**
   * Reached only if `onConnect` didn't authenticate AND the client is sending
   * an Auth message with a token. Under the gateway pattern no caller should
   * be here — identity must come from forwardAuth headers. Fail closed.
   */
  async onAuthenticate(
    data: WithAuthenticationContext<onAuthenticatePayload>
  ): Promise<AuthenticationContext | void> {
    if (data.connectionConfig.isAuthenticated) {
      return Promise.resolve();
    }

    this.logger.verbose?.(
      {
        message:
          '[onAuthenticate] No X-Alkemio-Actor-Id from gateway and no fallback path — denying.',
        documentId: data.documentName,
      },
      LogContext.AUTHENTICATION
    );

    throw new AuthenticationException('User is not authenticated.', LogContext.AUTHENTICATION, {
      documentId: data.documentName,
    });
  }

  /**
   * Called once after a connection has been successfully established.
   */
  connected(data: WithAuthenticationContext<connectedPayload>): Promise<void> {
    if (this.logger.verbose) {
      const {
        context: { authenticatedBy, userInfo },
      } = data;
      this.logger.verbose?.(
        {
          message: `[${authenticatedBy}] Actor authenticated and connected`,
          userId: userInfo?.id,
          documentId: data.documentName,
        },
        LogContext.AUTHENTICATION
      );
    }
    return Promise.resolve();
  }
}

function extractActorIdHeader(
  headers: Record<string, string | string[] | undefined> | undefined
): string | undefined {
  if (!headers) {
    return undefined;
  }

  const raw = headers[HEADER_ACTOR_ID_LOWER];
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (typeof value !== 'string') {
    return undefined;
  }

  // A whitespace-only id means gateway misconfiguration — treat as absent.
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
