import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Server } from '@hocuspocus/server';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { ConfigService } from '@nestjs/config';
import { ConfigType } from '../config';

@Injectable()
export class HocuspocusServer implements OnModuleInit {
  private readonly hocuspocusServer: Server;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: WinstonLogger,
    private readonly config: ConfigService<ConfigType, true>
  ) {
    const port = this.config.get('settings.application.port', { infer: true });
    this.hocuspocusServer = new Server({
      port,
      extensions: [],
    });
  }
  async onModuleInit() {
    await this.hocuspocusServer.listen();
  }

  async onModuleDestroy() {
    await this.hocuspocusServer.destroy();
  }

  public getServer(): Server {
    return this.hocuspocusServer;
  }
}
