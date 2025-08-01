import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { ClientProxy, ClientProxyFactory, RmqOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { catchError, map, retry, timeInterval, timeout } from 'rxjs/operators';
import { firstValueFrom, timer } from 'rxjs';
import { LogContext } from '@common/enums';
import { ConfigType } from '@src/config';
import {
  IntegrationEventPattern,
  IntegrationMessagePattern,
  RetryException,
  RMQConnectionError,
  TimeoutException,
  UserInfo,
} from './types';
import { HealthCheckOutputData } from './outputs';
import {
  FetchInputData,
  InfoInputData,
  SaveInputData,
  WhoInputData,
} from '@src/services/integration/inputs';
import {
  FetchErrorCodes,
  FetchErrorData,
  FetchOutputData,
  InfoOutputData,
  SaveErrorData,
  SaveOutputData,
} from './outputs';

@Injectable()
export class IntegrationService implements OnModuleInit, OnModuleDestroy {
  private client: ClientProxy | undefined;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private logger: WinstonLogger,
    private readonly configService: ConfigService<ConfigType, true>
  ) {
    this.timeoutMs = this.configService.get('settings.application.queue_response_timeout', {
      infer: true,
    });
    this.retries = this.configService.get('settings.application.queue_request_retries', {
      infer: true,
    });
  }
  public async onModuleInit() {
    const rabbitMqOptions = this.configService.get('rabbitmq.connection', {
      infer: true,
    });
    const queue = this.configService.get('settings.application.queue', {
      infer: true,
    });

    this.client = clientProxyFactory(
      {
        ...rabbitMqOptions,
        queue,
      },
      this.logger
    );

    if (!this.client) {
      this.logger.error(
        `${IntegrationService.name} not initialized`,
        undefined,
        LogContext.INTEGRATION
      );
      return;
    }

    try {
      await this.client.connect();
      this.logger.verbose?.(
        'Client proxy successfully connected to RabbitMQ',
        LogContext.INTEGRATION
      );
    } catch (e) {
      const error = e as RMQConnectionError | undefined;
      this.logger.error(error?.err, error?.err.stack, LogContext.INTEGRATION);
    }
  }

  public onModuleDestroy() {
    this.client?.close();
  }
  /**
   * Is there a healthy connection to the queue
   */
  public async isConnected(): Promise<boolean> {
    return this.sendWithResponse<HealthCheckOutputData, string>(
      IntegrationMessagePattern.HEALTH_CHECK,
      'healthy?',
      { timeoutMs: 3000 }
    )
      .then(resp => resp.healthy)
      .catch(() => false);
  }

  public async who(data: WhoInputData) {
    return this.sendWithResponse<UserInfo, WhoInputData>(IntegrationMessagePattern.WHO, data);
  }

  public async info(data: InfoInputData) {
    return this.sendWithResponse<InfoOutputData, InfoInputData>(
      IntegrationMessagePattern.INFO,
      data
    );
  }

  public async save(data: SaveInputData) {
    try {
      return await this.sendWithResponse<SaveOutputData, SaveInputData>(
        IntegrationMessagePattern.SAVE,
        data
      );
    } catch (e: any) {
      return new SaveOutputData(new SaveErrorData(e?.message ?? JSON.stringify(e)));
    }
  }

  public async fetch(data: FetchInputData) {
    try {
      return await this.sendWithResponse<FetchOutputData, FetchInputData>(
        IntegrationMessagePattern.FETCH,
        data
      );
    } catch (e: any) {
      return new FetchOutputData(
        new FetchErrorData(e?.message ?? JSON.stringify(e), FetchErrorCodes.INTERNAL_ERROR)
      );
    }
  }

  /**
   * Sends a message to the queue and waits for a response.
   * Each consumer needs to manually handle failures, returning the proper type.
   * @param pattern
   * @param data
   * @param options
   * @throws Error if the connection is not established, or if the request times out or exceeds the maximum number of retries.
   * @returns Promise with the response data of type TResult.
   */
  private sendWithResponse = async <TResult, TInput>(
    pattern: IntegrationMessagePattern,
    data: TInput,
    options?: { timeoutMs?: number; retries?: number }
  ): Promise<TResult | never> => {
    if (!this.client) {
      throw new Error('Connection was not established. Send failed.');
    }

    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;
    const retries = options?.retries ?? this.retries;

    const result$ = this.client.send<TResult, TInput>(pattern, data).pipe(
      timeInterval(),
      timeout({
        each: timeoutMs,
        with: () => {
          throw new TimeoutException(LogContext.INTEGRATION, {
            timeout: this.timeoutMs,
            pattern,
            data,
          });
        },
      }),
      retry({
        count: retries,
        delay: (error, retryCount) => {
          if (retryCount === this.retries) {
            throw new RetryException(LogContext.INTEGRATION, {
              retries: this.retries,
              data,
              originalError: error,
              cause: `Max retries (${this.retries}) reached`,
            });
          }

          this.logger.warn?.(
            `Retrying request to collaboration service [${++retryCount}/${this.retries}]`,
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
                message: `Max retries reached (${this.retries}) while waiting for response`,
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

  /**
   * Sends a message to the queue without waiting for a response.
   * Each consumer needs to manually handle failures, returning the proper type.
   * @param pattern
   * @param data
   */
  private sendWithoutResponse = <TInput>(
    pattern: IntegrationEventPattern,
    data: TInput
  ): void | never => {
    if (!this.client) {
      throw new Error('Connection was not established. Send failed.');
    }

    this.logger.debug?.(
      {
        method: 'sendWithoutResponse',
        pattern,
        data,
      },
      LogContext.INTEGRATION
    );

    this.client.emit<void, TInput>(pattern, data);
  };
}

const clientProxyFactory = (
  config: {
    user: string;
    password: string;
    host: string;
    port: number;
    heartbeat: number;
    queue: string;
  },
  logger: WinstonLogger
): ClientProxy | undefined => {
  const { host, port, user, password, heartbeat: _heartbeat, queue } = config;
  const heartbeat = process.env.NODE_ENV === 'production' ? _heartbeat : _heartbeat * 3;
  logger.verbose?.({ ...config, heartbeat, password: undefined }, LogContext.INTEGRATION);
  try {
    const options: RmqOptions = {
      transport: Transport.RMQ,
      options: {
        urls: [
          {
            protocol: 'amqp',
            hostname: host,
            username: user,
            password,
            port,
            heartbeat,
          },
        ],
        queue,
        queueOptions: { durable: true },
        noAck: true,
      },
    };
    return ClientProxyFactory.create(options);
  } catch (err: any) {
    logger.error(`Could not create client proxy: ${err}`, err?.stack, LogContext.INTEGRATION);
    return undefined;
  }
};
