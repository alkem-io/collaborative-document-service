import { ClientProxy } from '@nestjs/microservices';
import { mock, MockProxy } from 'vitest-mock-extended';
import { describe, it, expect, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { SenderService } from './sender.service';
import { IntegrationMessagePattern, RMQConnectionError, TimeoutException } from './types';
import { LogContext } from '@common/enums';

describe('SenderService', () => {
  let service: SenderService;
  let mockClient: MockProxy<ClientProxy>;
  let mockLogger: MockProxy<any>;

  beforeEach(() => {
    mockClient = mock<ClientProxy>();
    mockLogger = mock<any>();
    service = new SenderService(mockLogger as any);
  });

  it('should return the response value on success', async () => {
    const expected = { id: 'ok' };
    mockClient.send.mockReturnValue(of(expected));

    const result = await service.sendWithResponse(
      mockClient,
      IntegrationMessagePattern.WHO,
      {
        some: 'data',
      } as any,
      { timeoutMs: 1000, maxRetries: 2 }
    );

    expect(result).toEqual(expected);
  });

  it('should throw Timeout error message when a TimeoutException is emitted', async () => {
    const timeoutEx = new TimeoutException(LogContext.INTEGRATION, { timeout: 1000 });
    mockClient.send.mockReturnValue(throwError(() => timeoutEx));

    await expect(
      service.sendWithResponse(mockClient, IntegrationMessagePattern.WHO, { foo: 'bar' } as any, {
        timeoutMs: 1000,
        maxRetries: 0,
      })
    ).rejects.toThrow('Timeout while processing integration request.');
  });

  it('should throw Max retries error message when retry logic exhausts attempts', async () => {
    // Simulate a transient error that will be retried until the retry logic throws
    mockClient.send.mockReturnValue(throwError(() => new Error('transient')));

    await expect(
      service.sendWithResponse(mockClient, IntegrationMessagePattern.WHO, { foo: 'bar' } as any, {
        timeoutMs: 1000,
        maxRetries: 1,
      })
    ).rejects.toThrow('Max retries reached while processing integration request.');
  });

  it('should throw RMQ connection error message when RMQConnectionError is emitted', async () => {
    const rmq = new RMQConnectionError();
    rmq.err = { message: 'conn failed', stack: 'stack' };
    mockClient.send.mockReturnValue(throwError(() => rmq));

    await expect(
      service.sendWithResponse(mockClient, IntegrationMessagePattern.WHO, { foo: 'bar' } as any, {
        timeoutMs: 1000,
        maxRetries: 0,
      })
    ).rejects.toThrow('RMQ connection error while processing integration request.');
  });

  it('should throw generic Error message for plain Error emissions', async () => {
    const err = new Error('boom');
    mockClient.send.mockReturnValue(throwError(() => err));

    await expect(
      service.sendWithResponse(mockClient, IntegrationMessagePattern.WHO, { foo: 'bar' } as any, {
        timeoutMs: 1000,
        maxRetries: 0,
      })
    ).rejects.toThrow('Error error while processing integration request.');
  });

  it('should handle undefined/null errors and throw an appropriate message', async () => {
    // simulate an observable that errors with undefined
    mockClient.send.mockReturnValue(throwError(() => undefined as any));

    await expect(
      service.sendWithResponse(mockClient, IntegrationMessagePattern.WHO, { foo: 'bar' } as any, {
        timeoutMs: 1000,
        maxRetries: 0,
      })
    ).rejects.toThrow("'undefined' error caught while processing integration request.");
  });
});
