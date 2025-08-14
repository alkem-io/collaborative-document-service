import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { Server } from '@hocuspocus/server';
import { ConfigService } from '@nestjs/config';
import { ConfigType } from '../config';
import { AUTHENTICATION_EXTENSION } from '@src/hocuspocus/extensions/authentication';
import { AbstractAuthenticator } from '@src/hocuspocus/extensions/authentication';
import { AbstractStorage, STORAGE_EXTENSION } from '@src/hocuspocus/extensions/storage';

@Injectable()
export class HocuspocusServer implements OnModuleInit, OnModuleDestroy {
  private readonly hocuspocusServer: Server;

  constructor(
    private readonly config: ConfigService<ConfigType, true>,
    @Inject(AUTHENTICATION_EXTENSION) Authentication: AbstractAuthenticator,
    @Inject(STORAGE_EXTENSION) Storage: AbstractStorage
  ) {
    this.hocuspocusServer = new Server({
      extensions: [Authentication, Storage],
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
