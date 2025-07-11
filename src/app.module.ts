import { WinstonModule } from 'nest-winston';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonConfigService } from './config/winston.config.js';
import configuration from './config/configuration.js';
import { HocuspocusModule } from './hocuspocus/hocuspocus.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env'],
      isGlobal: true,
      load: [configuration],
    }),
    WinstonModule.forRootAsync({
      useClass: WinstonConfigService,
    }),
    HocuspocusModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply().forRoutes('/');
  }
}
