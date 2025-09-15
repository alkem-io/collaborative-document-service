import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { Server } from '@hocuspocus/server';
import { ConfigService } from '@nestjs/config';
import { ConfigType } from '../config';
import { AUTHENTICATION_EXTENSION } from '@src/hocuspocus/extensions/authentication';
import { AbstractAuthentication } from '@src/hocuspocus/extensions/authentication';
import { AbstractStorage, STORAGE_EXTENSION } from '@src/hocuspocus/extensions/storage';
import { NORTH_STAR_METRIC_EXTENSION } from '@src/hocuspocus/extensions/north-star-metric';
import { NorthStarMetric } from '@src/hocuspocus/extensions/north-star-metric/north.star.metric.extension';

@Injectable()
export class HocuspocusServer implements OnModuleInit, OnModuleDestroy {
  private readonly hocuspocusServer: Server;

  constructor(
    private readonly config: ConfigService<ConfigType, true>,
    @Inject(AUTHENTICATION_EXTENSION) Authentication: AbstractAuthentication,
    @Inject(STORAGE_EXTENSION) Storage: AbstractStorage,
    @Inject(NORTH_STAR_METRIC_EXTENSION) NorthStarMetric: NorthStarMetric
  ) {
    this.hocuspocusServer = new Server({
      extensions: [Authentication, Storage, NorthStarMetric],
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
