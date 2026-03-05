import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Hocuspocus, Server } from '@hocuspocus/server';
import {
  AlkemioAuthorizer,
  ALKEMIO_AUTHORIZATION_EXTENSION,
} from './extensions/authorization/alkemio-authorizer';
import {
  AlkemioAuthenticator,
  ALKEMIO_AUTHENTICATION_EXTENSION,
} from './extensions/authentication/alkemio-authenticator';
import {
  ALKEMIO_STORAGE_EXTENSION,
  AlkemioStorage,
} from '@src/hocuspocus/extensions/storage/alkemio-storage';
import { NorthStarMetric, NORTH_STAR_METRIC_EXTENSION } from '@src/hocuspocus/extensions/north-star-metric';
import { ConfigType } from '../config';
import { sortExtensions } from './sort.extensions';

@Injectable()
export class HocuspocusServer implements OnModuleInit, OnModuleDestroy {
  private readonly hocuspocusServer: Server;

  constructor(
    private readonly config: ConfigService<ConfigType, true>,
    @Inject(ALKEMIO_AUTHENTICATION_EXTENSION) Authentication: AlkemioAuthenticator,
    @Inject(ALKEMIO_AUTHORIZATION_EXTENSION) Authorization: AlkemioAuthorizer,
    @Inject(ALKEMIO_STORAGE_EXTENSION) Storage: AlkemioStorage,
    @Inject(NORTH_STAR_METRIC_EXTENSION) NorthStarMetric: NorthStarMetric
  ) {
    const extensions = sortExtensions([Authentication, Authorization, Storage, NorthStarMetric]);
    this.hocuspocusServer = new Server({
      extensions,
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

  public getInstance(): Hocuspocus {
    return this.hocuspocusServer.hocuspocus;
  }
}
