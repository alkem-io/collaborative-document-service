import { WinstonModule } from 'nest-winston';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration, { WinstonConfigService } from '@src/config';
import { HocuspocusModule } from '@src/hocuspocus';

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
})
export class AppModule {}
