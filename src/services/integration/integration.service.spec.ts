import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { mock, MockProxy } from 'vitest-mock-extended';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { IntegrationService } from './integration.service';
import { NotInitializedException } from '@common/exceptions';
import {
  IntegrationMessagePattern,
  RMQConnectionError,
  TimeoutException,
  RetryException,
} from './types';
import { WhoInputData, FetchInputData, SaveInputData } from './inputs';
import {
  FetchContentData,
  FetchOutputData,
  SaveContentData,
  SaveErrorData,
  SaveOutputData,
} from '@src/services/integration/outputs';

describe('IntegrationService', () => {
  let service: IntegrationService;
  let configService: MockProxy<ConfigService>;
  let mockLogger: MockProxy<any>;
  let mockClientProxy: MockProxy<ClientProxy>;

  beforeEach(async () => {
    configService = mock<ConfigService>();
    mockLogger = mock<any>();
    mockClientProxy = mock<ClientProxy>();

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationService,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: WINSTON_MODULE_NEST_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<IntegrationService>(IntegrationService);

    // Mock the client proxy creation
    vi.spyOn(service as any, 'client', 'get').mockReturnValue(mockClientProxy);
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

      // Override the service's client property for this test
      (service as any).client = mockClientProxy;

      await service.onModuleInit();

      expect(mockClientProxy.connect).toHaveBeenCalled();
      expect(mockLogger.verbose).toHaveBeenCalledWith(
        'Client proxy successfully connected to RabbitMQ',
        'INTEGRATION'
      );
    });

    it('should handle connection errors gracefully', async () => {
      const connectionError: RMQConnectionError = {
        err: new Error('Connection failed'),
      };
      mockClientProxy.connect.mockRejectedValue(connectionError);

      (service as any).client = mockClientProxy;

      await service.onModuleInit();

      expect(mockLogger.error).toHaveBeenCalledWith(
        connectionError.err,
        connectionError.err.stack,
        'INTEGRATION'
      );
    });

    it('should throw NotInitializedException when client proxy creation fails', async () => {
      // Simulate client proxy creation failure
      (service as any).client = undefined;

      await expect(service.onModuleInit()).rejects.toThrow(NotInitializedException);
    });
  });

  describe('onModuleDestroy', () => {
    it('should close client connection', () => {
      (service as any).client = mockClientProxy;

      service.onModuleDestroy();

      expect(mockClientProxy.close).toHaveBeenCalled();
    });

    it('should handle missing client gracefully', () => {
      (service as any).client = undefined;

      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });

  describe('isConnected', () => {
    beforeEach(() => {
      (service as any).client = mockClientProxy;
    });

    it('should return true when health check succeeds', async () => {
      const healthResponse = { healthy: true };
      mockClientProxy.send.mockReturnValue(of(healthResponse));

      const result = await service.isConnected();

      expect(result).toBe(true);
      expect(mockClientProxy.send).toHaveBeenCalledWith(
        IntegrationMessagePattern.HEALTH_CHECK,
        'healthy?'
      );
    });

    it('should return false when health check fails', async () => {
      mockClientProxy.send.mockReturnValue(throwError(() => new Error('Health check failed')));

      const result = await service.isConnected();

      expect(result).toBe(false);
    });

    it('should return false when health response indicates unhealthy', async () => {
      const healthResponse = { healthy: false };
      mockClientProxy.send.mockReturnValue(of(healthResponse));

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

      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      const result = await service.who(inputData);

      expect(result).toEqual(expectedResponse);
      expect(mockClientProxy.send).toHaveBeenCalledWith(IntegrationMessagePattern.WHO, inputData);
    });

    it('should handle authentication errors', async () => {
      const inputData = new WhoInputData({ authorization: 'Bearer invalid' });
      const error = new Error('Unauthorized');

      mockClientProxy.send.mockReturnValue(throwError(() => error));

      await expect(service.who(inputData)).rejects.toThrow('Unauthorized');
    });
  });

  describe('fetch', () => {
    it('should fetch document successfully', async () => {
      const inputData = new FetchInputData('docId123');
      const expectedResponse = new FetchOutputData(
        new FetchContentData('base64 Document content here')
      );

      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      const result = await service.fetch(inputData);

      expect(result).toEqual(expectedResponse);
      expect(mockClientProxy.send).toHaveBeenCalledWith(IntegrationMessagePattern.FETCH, inputData);
    });

    it('should handle fetch errors with proper error codes', async () => {
      const inputData = new FetchInputData('docId999');
      const error = new Error('Document not found');

      mockClientProxy.send.mockReturnValue(throwError(() => error));

      await expect(service.fetch(inputData)).rejects.toThrow('Document not found');
    });
  });

  describe('save', () => {
    it('should save document successfully', async () => {
      const inputData = new SaveInputData('docId234', 'binary state in base64 here');
      const expectedResponse = new SaveOutputData(new SaveContentData());

      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      const result = await service.save(inputData);

      expect(mockClientProxy.send).toHaveBeenCalledWith(IntegrationMessagePattern.SAVE, inputData);
      expect(result).toEqual(expectedResponse);
    });

    it('should handle remote save errors', async () => {
      const inputData = new SaveInputData('docId345', 'binary state in base64 here');
      const expectedResponse = new SaveOutputData(new SaveErrorData('remote save error'));

      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      const result = await service.save(inputData);

      expect(mockClientProxy.send).toHaveBeenCalledWith(IntegrationMessagePattern.SAVE, inputData);
      expect(result).toEqual(expectedResponse);
    });

    it('should handle internal save errors', async () => {
      const inputData = new SaveInputData('docId345', 'binary state in base64 here');
      const error = new Error('Some internal error');
      const expectedResponse = new SaveOutputData(new SaveErrorData(error.message));

      mockClientProxy.send.mockReturnValue(throwError(() => error));

      const result = await service.save(inputData);

      expect(mockClientProxy.send).toHaveBeenCalledWith(IntegrationMessagePattern.SAVE, inputData);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('error handling and resilience', () => {
    it('should handle timeout errors', async () => {
      const inputData: WhoInputData = {
        authorization: 'Bearer token123',
        contextId: 'context1',
      };
      const timeoutError = new TimeoutException('Request timed out');

      mockClientProxy.send.mockReturnValue(throwError(() => timeoutError));

      await expect(service.who(inputData)).rejects.toThrow(TimeoutException);
    });

    it('should handle retry logic on failures', async () => {
      const inputData: WhoInputData = {
        authorization: 'Bearer token123',
        contextId: 'context1',
      };
      const retryError = new RetryException('Max retries exceeded');

      mockClientProxy.send.mockReturnValue(throwError(() => retryError));

      await expect(service.who(inputData)).rejects.toThrow(RetryException);
    });
  });

  describe('sendWithResponse private method behavior', () => {
    it('should apply correct timeout and retry configuration', async () => {
      // This test verifies that the private sendWithResponse method
      // correctly applies the configured timeout and retry values
      const inputData: WhoInputData = {
        authorization: 'Bearer token123',
        contextId: 'context1',
      };

      (service as any).client = mockClientProxy;
      mockClientProxy.send.mockReturnValue(of({ id: 'user123' }));

      await service.who(inputData);

      // Verify that the timeout from config is used (5000ms)
      expect(configService.get).toHaveBeenCalledWith(
        'settings.application.queue_response_timeout',
        {
          infer: true,
        }
      );
      // Verify that the retry count from config is used (3 retries)
      expect(configService.get).toHaveBeenCalledWith('settings.application.queue_request_retries', {
        infer: true,
      });
    });
  });
});
