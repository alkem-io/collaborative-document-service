import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { mock, MockProxy } from 'vitest-mock-extended';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationService } from './integration.service';
import { NotInitializedException } from '@common/exceptions';
import {
  IntegrationMessagePattern,
  RetryException,
  RMQConnectionError,
  TimeoutException,
} from './types';
import { FetchInputData, SaveInputData, WhoInputData } from './inputs';
import {
  FetchContentData,
  FetchErrorCodes,
  FetchErrorData,
  FetchOutputData,
  HealthCheckOutputData,
  SaveContentData,
  SaveErrorData,
  SaveOutputData,
} from '@src/services/integration/outputs';
import { defaultMockerFactory } from '@test/utils';
import { SenderService } from './sender.service';
import * as clientProxyFactory from './client-proxy.factory';

// Mock the client proxy factory
vi.mock('./client-proxy.factory', () => ({
  clientProxyFactory: vi.fn(),
}));

describe('IntegrationService', () => {
  let service: IntegrationService;
  let configService: MockProxy<ConfigService>;
  let mockClientProxy: MockProxy<ClientProxy>;
  let mockSenderService: MockProxy<SenderService>;

  beforeEach(async () => {
    configService = mock<ConfigService>();
    mockClientProxy = mock<ClientProxy>();
    mockSenderService = mock<SenderService>();

    // Setup default config values
    configService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'settings.application.queue_response_timeout':
          return 5000;
        case 'settings.application.queue_request_retries':
          return 3;
        case 'rabbitmq.connection':
          return {
            transport: 'RMQ',
            options: {
              urls: ['amqp://localhost:5672'],
              queue: 'test_queue',
            },
          };
        case 'settings.application.queue':
          return 'test_queue';
        default:
          return undefined;
      }
    });

    // Mock the clientProxyFactory to return our mock client
    vi.mocked(clientProxyFactory.clientProxyFactory).mockReturnValue(mockClientProxy);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationService,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: SenderService,
          useValue: mockSenderService,
        },
      ],
    })
      .useMocker(defaultMockerFactory)
      .compile();

    service = module.get<IntegrationService>(IntegrationService);
    await service.onModuleInit();
  });

  describe('constructor', () => {
    it('should initialize with correct timeout and retry values from config', () => {
      expect(configService.get).toHaveBeenCalledWith(
        'settings.application.queue_response_timeout',
        {
          infer: true,
        }
      );
      expect(configService.get).toHaveBeenCalledWith('settings.application.queue_request_retries', {
        infer: true,
      });
    });
  });

  describe('onModuleInit', () => {
    it('should initialize client proxy and connect successfully', async () => {
      mockClientProxy.connect.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockClientProxy.connect).toHaveBeenCalled();
    });

    it('should handle connection errors gracefully', async () => {
      const connectionError: RMQConnectionError = {
        err: { message: 'Connection failed', stack: 'stack' },
        url: {
          protocol: 'amqp',
          hostname: 'localhost',
          username: 'guest',
          password: 'guest',
          port: 5672,
          heartbeat: 60,
        },
      };
      mockClientProxy.connect.mockRejectedValue(connectionError);

      await service.onModuleInit();
    });

    it('should throw NotInitializedException when client proxy creation fails', async () => {
      vi.mocked(clientProxyFactory.clientProxyFactory).mockImplementation(() => {
        throw new Error('Factory error');
      });

      await expect(service.onModuleInit()).rejects.toThrow(NotInitializedException);
    });
  });

  describe('onModuleDestroy', () => {
    it('should close client connection', () => {
      service.onModuleDestroy();

      expect(mockClientProxy.close).toHaveBeenCalled();
    });

    it('should handle missing client gracefully', () => {
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return true when health check succeeds', async () => {
      const healthResponse = new HealthCheckOutputData(true);
      mockSenderService.sendWithResponse.mockResolvedValue(healthResponse);

      const result = await service.isConnected();

      expect(result).toBe(true);
      expect(mockSenderService.sendWithResponse).toHaveBeenCalledWith(
        mockClientProxy,
        IntegrationMessagePattern.HEALTH_CHECK,
        'healthy?',
        (service as any).defaultRequestConfig
      );
    });

    it('should return false when health check fails', async () => {
      mockSenderService.sendWithResponse.mockRejectedValue(new Error('Health check failed'));

      const result = await service.isConnected();

      expect(result).toBe(false);
    });

    it('should return false when health response indicates unhealthy', async () => {
      const healthResponse = { healthy: false };
      mockSenderService.sendWithResponse.mockResolvedValue(healthResponse as any);

      const result = await service.isConnected();

      expect(result).toBe(false);
    });
  });

  describe('who', () => {
    it('should send who request and return user info', async () => {
      const inputData = new WhoInputData({ authorization: 'Bearer token123' });
      const expectedResponse = {
        id: 'user123',
        email: 'user@test.com',
        displayName: 'Test User',
      };

      mockSenderService.sendWithResponse.mockResolvedValue(expectedResponse as any);

      const result = await service.who(inputData);

      expect(result).toEqual(expectedResponse);
      expect(mockSenderService.sendWithResponse).toHaveBeenCalledWith(
        mockClientProxy,
        IntegrationMessagePattern.WHO,
        inputData,
        (service as any).defaultRequestConfig
      );
    });

    it('should handle authentication errors', async () => {
      const inputData = new WhoInputData({ authorization: 'Bearer invalid' });
      const error = new Error('Unauthorized');

      mockSenderService.sendWithResponse.mockRejectedValue(error);
      const result = await service.who(inputData);

      expect(result).toBeUndefined();
    });
  });

  describe('fetch', () => {
    it('should fetch document successfully', async () => {
      const inputData = new FetchInputData('docId123');
      const expectedResponse = new FetchOutputData(
        new FetchContentData('base64 Document content here')
      );

      mockSenderService.sendWithResponse.mockResolvedValue(expectedResponse as any);

      const result = await service.fetch(inputData);

      expect(result).toEqual(expectedResponse);
      expect(mockSenderService.sendWithResponse).toHaveBeenCalledWith(
        mockClientProxy,
        IntegrationMessagePattern.FETCH,
        inputData,
        (service as any).defaultRequestConfig
      );
    });

    it('should handle internal error', async () => {
      const inputData = new FetchInputData('docId999');
      const error = new Error('Some internal error');
      const expectedResult = new FetchOutputData(
        new FetchErrorData(error.message, FetchErrorCodes.INTERNAL_ERROR)
      );
      mockSenderService.sendWithResponse.mockRejectedValue(error);
      // act
      const result = await service.fetch(inputData);
      // assert
      expect(result).toEqual(expectedResult);
    });
  });

  describe('save', () => {
    it('should save document successfully', async () => {
      const inputData = new SaveInputData('docId234', 'binary state in base64 here');
      const expectedResponse = new SaveOutputData(new SaveContentData());

      mockSenderService.sendWithResponse.mockResolvedValue(expectedResponse as any);

      const result = await service.save(inputData);

      expect(mockSenderService.sendWithResponse).toHaveBeenCalledWith(
        mockClientProxy,
        IntegrationMessagePattern.SAVE,
        inputData,
        (service as any).defaultRequestConfig
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should handle remote save errors', async () => {
      const inputData = new SaveInputData('docId345', 'binary state in base64 here');
      const expectedResponse = new SaveOutputData(new SaveErrorData('remote save error'));

      mockSenderService.sendWithResponse.mockResolvedValue(expectedResponse as any);

      const result = await service.save(inputData);

      expect(mockSenderService.sendWithResponse).toHaveBeenCalledWith(
        mockClientProxy,
        IntegrationMessagePattern.SAVE,
        inputData,
        (service as any).defaultRequestConfig
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should handle internal save errors', async () => {
      const inputData = new SaveInputData('docId345', 'binary state in base64 here');
      const error = new Error('Some internal error');
      const expectedResponse = new SaveOutputData(new SaveErrorData(error.message));

      mockSenderService.sendWithResponse.mockRejectedValue(error);

      const result = await service.save(inputData);

      expect(mockSenderService.sendWithResponse).toHaveBeenCalledWith(
        mockClientProxy,
        IntegrationMessagePattern.SAVE,
        inputData,
        (service as any).defaultRequestConfig
      );
      expect(result).toEqual(expectedResponse);
    });
  });
});
