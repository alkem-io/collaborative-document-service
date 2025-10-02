import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { WinstonLogger } from 'nest-winston';
import { firstValueFrom, timer } from 'rxjs';
import { catchError, retry, timeout, timeInterval, map } from 'rxjs/operators';
import { LogContext } from '@common/enums';
import {
  IntegrationMessagePattern,
  RetryException,
  RMQConnectionError,
  TimeoutException,
} from './types';

export interface SendOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

@Injectable()
export class SenderService {
  constructor(private readonly logger: WinstonLogger) {}

  /**
   * Sends a message to the queue and waits for a response.
   * Each consumer needs to manually handle failures, returning the proper type.
   * @param client
   * @param pattern
   * @param data
   * @param options
   * @throws Error if the connection is not established, or if the request times out or exceeds the maximum number of retries.
   * @returns Promise with the response data of type TResult.
   */
  public sendWithResponse = async <TResult, TInput>(
    client: ClientProxy,
    pattern: IntegrationMessagePattern,
    data: TInput,
    options?: { timeoutMs?: number; maxRetries?: number }
  ): Promise<TResult | never> => {
    const timeoutMs = options?.timeoutMs;
    const maxRetries = options?.maxRetries;

    const result$ = client.send<TResult, TInput>(pattern, data).pipe(
      timeInterval(),
      timeout({
        each: timeoutMs,
        with: () => {
          throw new TimeoutException(LogContext.INTEGRATION, {
            timeout: timeoutMs,
            pattern,
            data,
          });
        },
      }),
      retry({
        count: maxRetries,
        delay: (error, retryCount) => {
          if (retryCount === maxRetries) {
            throw new RetryException(LogContext.INTEGRATION, {
              retries: maxRetries,
              data,
              originalError: error,
              cause: `Max retries (${maxRetries}) reached`,
            });
          }

          this.logger.warn?.(
            `Retrying request to collaboration service [${retryCount + 1}/${maxRetries}]`,
            LogContext.INTEGRATION
          );
          // exponential backoff strategy
          const backoff = Math.pow(2, retryCount) * 10;
          return timer(backoff);
        },
      }),
      catchError(
        (
          error:
            | RMQConnectionError
            | TimeoutException
            | RetryException
            | Error
            | Record<string, unknown>
            | undefined
            | null
        ) => {
          // null or undefined
          if (error == undefined) {
            this.logger.error(
              {
                message: `'${error}' error caught while processing integration request.`,
                pattern,
                timeout: timeoutMs,
              },
              LogContext.INTEGRATION
            );

            throw new Error(`'${error}' error caught while processing integration request.`);
          }

          if (error instanceof RetryException) {
            this.logger.error(
              {
                message: `Max retries reached (${maxRetries}) while waiting for response`,
                pattern,
                timeout: timeoutMs,
              },
              error.stack,
              LogContext.INTEGRATION
            );

            throw new Error('Max retries reached while processing integration request.');
          }

          if (error instanceof TimeoutException) {
            this.logger.error(
              {
                message: 'Timeout was reached while waiting for response',
                pattern,
                timeout: timeoutMs,
              },
              error.stack,
              LogContext.INTEGRATION
            );

            throw new Error('Timeout while processing integration request.');
          } else if (error instanceof RMQConnectionError) {
            this.logger.error(
              {
                message: `RMQ connection error was received while waiting for response: ${error?.err?.message}`,
                pattern,
                timeout: timeoutMs,
              },
              error?.err?.stack,
              LogContext.INTEGRATION
            );

            throw new Error('RMQ connection error while processing integration request.');
          } else if (error instanceof Error) {
            this.logger.error(
              {
                message: `Error was received while waiting for response: ${error.message}`,
                pattern,
                timeout: timeoutMs,
              },
              error.stack,
              LogContext.INTEGRATION
            );

            throw new Error(`${error.name} error while processing integration request.`);
          } else {
            this.logger.error(
              {
                message: `Unknown error was received while waiting for response: ${JSON.stringify(error, null, 2)}`,
                pattern,
                timeout: timeoutMs,
              },
              undefined,
              LogContext.INTEGRATION
            );

            throw new Error('Unknown error while processing integration request.');
          }
        }
      ),
      map(x => {
        this.logger.debug?.(
          {
            method: `sendWithResponse response took ${x.interval}ms`,
            pattern,
            data,
            value: x.value,
          },
          LogContext.INTEGRATION
        );
        return x.value;
      })
    );

    return firstValueFrom(result$);
  };
}
