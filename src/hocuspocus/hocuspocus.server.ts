import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Server } from '@hocuspocus/server';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { ConfigService } from '@nestjs/config';
import { ConfigType } from '../config';

@Injectable()
export class HocuspocusServer implements OnModuleInit, OnModuleDestroy {
  private readonly hocuspocusServer: Server;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: WinstonLogger,
    private readonly config: ConfigService<ConfigType, true>
  ) {
    this.hocuspocusServer = new Server({
      extensions: [],
    });
  }
  async onModuleInit() {
    const port = this.config.get('settings.application.ws_port', { infer: true });
    await this.hocuspocusServer.listen(port);
  }

  async onModuleDestroy() {
    await this.hocuspocusServer.destroy();
  }

  public getServer(): Server {
    return this.hocuspocusServer;
  }
}
