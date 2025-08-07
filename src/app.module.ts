import { WinstonModule } from 'nest-winston';
import { HocuspocusModule } from '@src/hocuspocus';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration, { WinstonConfigService } from '@src/config';
import { UnhandledExceptionFilter } from './core/nest-filters';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env'],
      isGlobal: true,
      load: [configuration],
    }),
    WinstonModule.forRootAsync({ useClass: WinstonConfigService }),
    HocuspocusModule,
  ],
  providers: [
    {
      // This should be the first filter in the list:
      // See Catch everything at: https://docs.nestjs.com/exception-filters
      provide: APP_FILTER,
      useClass: UnhandledExceptionFilter,
    },
  ],
})
export class AppModule {}
