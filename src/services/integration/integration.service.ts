import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { ClientProxy } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { LogContext } from '@common/enums';
import { ConfigType } from '@src/config';
import { NotInitializedException } from '@common/exceptions';
import { IntegrationMessagePattern, RMQConnectionError, UserInfo } from './types';
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
import { clientProxyFactory } from './client-proxy.factory';
import { SenderService } from './sender.service';

@Injectable()
export class IntegrationService implements OnModuleInit, OnModuleDestroy {
  private client: ClientProxy | undefined;
  private readonly defaultRequestConfig: { timeoutMs: number; maxRetries: number };

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private logger: WinstonLogger,
    private readonly configService: ConfigService<ConfigType, true>,
    private readonly senderService: SenderService
  ) {
    this.defaultRequestConfig = {
      timeoutMs: this.configService.get('settings.application.queue_response_timeout', {
        infer: true,
      }),
      maxRetries: this.configService.get('settings.application.queue_request_retries', {
        infer: true,
      }),
    };
  }
  public async onModuleInit() {
    const rabbitMqOptions = this.configService.get('rabbitmq.connection', {
      infer: true,
    });
    const queue = this.configService.get('settings.application.queue', {
      infer: true,
    });

    try {
      this.client = clientProxyFactory({
        ...rabbitMqOptions,
        queue,
      });
    } catch {
      this.client = undefined;
    }

    if (!this.client) {
      throw new NotInitializedException(
        `${IntegrationService.name} failed to initialize: Client proxy could not be created`,
        LogContext.INTEGRATION
      );
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
    if (!this.client) {
      return false;
    }

    return this.senderService
      .sendWithResponse<HealthCheckOutputData, string>(
        this.client,
        IntegrationMessagePattern.HEALTH_CHECK,
        'healthy?',
        this.defaultRequestConfig
      )
      .then(resp => resp.healthy)
      .catch(() => false);
  }

  public async who(data: WhoInputData) {
    if (!this.client) {
      throw new Error('Connection was not established. Send failed.');
    }

    try {
      return await this.senderService.sendWithResponse<UserInfo, WhoInputData>(
        this.client,
        IntegrationMessagePattern.WHO,
        data,
        this.defaultRequestConfig
      );
    } catch (e: any) {
      this.logger.error(
        {
          message: 'Who request failed',
          error: e,
        },
        e?.stack,
        LogContext.INTEGRATION
      );
      return undefined;
    }
  }

  public async info(data: InfoInputData) {
    if (!this.client) {
      throw new Error('Connection was not established. Send failed.');
    }

    try {
      return await this.senderService.sendWithResponse<InfoOutputData, InfoInputData>(
        this.client,
        IntegrationMessagePattern.INFO,
        data,
        this.defaultRequestConfig
      );
    } catch (e: any) {
      this.logger.error(
        {
          message: 'Info request failed',
          error: e,
        },
        e?.stack,
        LogContext.INTEGRATION
      );
      return new InfoOutputData(false, false, false, 0);
    }
  }

  public async save(data: SaveInputData) {
    if (!this.client) {
      throw new Error('Connection was not established. Send failed.');
    }

    try {
      return await this.senderService.sendWithResponse<SaveOutputData, SaveInputData>(
        this.client,
        IntegrationMessagePattern.SAVE,
        data,
        this.defaultRequestConfig
      );
    } catch (e: any) {
      this.logger.error(
        {
          message: 'Save request failed',
          error: e,
        },
        e?.stack,
        LogContext.INTEGRATION
      );
      return new SaveOutputData(new SaveErrorData(e?.message ?? JSON.stringify(e)));
    }
  }

  public async fetch(data: FetchInputData) {
    if (!this.client) {
      throw new Error('Connection was not established. Send failed.');
    }

    try {
      return await this.senderService.sendWithResponse<FetchOutputData, FetchInputData>(
        this.client,
        IntegrationMessagePattern.FETCH,
        data,
        this.defaultRequestConfig
      );
    } catch (e: any) {
      this.logger.error(
        {
          message: 'Fetch request failed',
          error: e,
        },
        e?.stack,
        LogContext.INTEGRATION
      );
      return new FetchOutputData(
        new FetchErrorData(e?.message ?? JSON.stringify(e), FetchErrorCodes.INTERNAL_ERROR)
      );
    }
  }
}
