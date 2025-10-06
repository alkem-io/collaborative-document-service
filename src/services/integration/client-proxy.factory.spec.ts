import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { clientProxyFactory, ClientProxyConfig } from './client-proxy.factory';

// Mock the ClientProxyFactory
vi.mock('@nestjs/microservices', () => ({
  Transport: {
    RMQ: 'RMQ',
  },
  ClientProxyFactory: {
    create: vi.fn(),
  },
}));

describe('clientProxyFactory', () => {
  let mockClientProxy: any;
  let defaultConfig: ClientProxyConfig;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    mockClientProxy = {
      connect: vi.fn(),
      close: vi.fn(),
      send: vi.fn(),
      emit: vi.fn(),
    };

    defaultConfig = {
      user: 'testuser',
      password: 'testpassword',
      host: 'localhost',
      port: 5672,
      heartbeat: 60,
      queue: 'test_queue',
    };

    // Store original NODE_ENV
    originalNodeEnv = process.env.NODE_ENV;

    // Reset mocks
    vi.mocked(ClientProxyFactory.create).mockReturnValue(mockClientProxy);
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original NODE_ENV
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe('successful client proxy creation', () => {
    it('should create a client proxy with correct configuration in production', () => {
      // Arrange
      process.env.NODE_ENV = 'production';

      // Act
      const result = clientProxyFactory(defaultConfig);

      // Assert
      expect(result).toBe(mockClientProxy);
      expect(ClientProxyFactory.create).toHaveBeenCalledWith({
        transport: Transport.RMQ,
        options: {
          urls: [
            {
              protocol: 'amqp',
              hostname: 'localhost',
              username: 'testuser',
              password: 'testpassword',
              port: 5672,
              heartbeat: 60, // Same as configured in production
            },
          ],
          queue: 'test_queue',
          queueOptions: { durable: true },
          noAck: true,
        },
      });
    });

    it('should create a client proxy with 3x heartbeat in non-production environment', () => {
      // Arrange
      process.env.NODE_ENV = 'development';

      // Act
      const result = clientProxyFactory(defaultConfig);

      // Assert
      expect(result).toBe(mockClientProxy);
      expect(ClientProxyFactory.create).toHaveBeenCalledWith({
        transport: Transport.RMQ,
        options: {
          urls: [
            {
              protocol: 'amqp',
              hostname: 'localhost',
              username: 'testuser',
              password: 'testpassword',
              port: 5672,
              heartbeat: 180, // 3x the configured value in non-production
            },
          ],
          queue: 'test_queue',
          queueOptions: { durable: true },
          noAck: true,
        },
      });
    });

    it('should create a client proxy with 3x heartbeat when NODE_ENV is undefined', () => {
      // Arrange
      delete process.env.NODE_ENV;

      // Act
      const result = clientProxyFactory(defaultConfig);

      // Assert
      expect(result).toBe(mockClientProxy);
      expect(ClientProxyFactory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
          urls: [expect.objectContaining({ heartbeat: 180 })], // 3x the configured value
        }),
      }));
    });
  });

  describe('error handling', () => {
    it('should throw error when ClientProxyFactory.create throws', () => {
      // Arrange
      const error = new Error('Failed to create client proxy');
      vi.mocked(ClientProxyFactory.create).mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      expect(() => clientProxyFactory(defaultConfig)).toThrow('Failed to create client proxy');
    });

    it('should throw error when ClientProxyFactory.create throws non-Error object', () => {
      // Arrange
      const errorString = 'String error';
      vi.mocked(ClientProxyFactory.create).mockImplementation(() => {
        throw errorString;
      });

      // Act & Assert
      expect(() => clientProxyFactory(defaultConfig)).toThrow();
    });
  });
});
