import { Injectable, Inject } from '@nestjs/common';
import { Server } from '@hocuspocus/server';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { ConfigService } from '@nestjs/config';
import { ConfigType } from '../config';

@Injectable()
export class HocuspocusServer {
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
    this.hocuspocusServer.listen();
  }

  public getServer(): Server {
    return this.hocuspocusServer;
  }
}
