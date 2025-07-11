import { Module } from '@nestjs/common';
import { HocuspocusServer } from './hocuspocus.server.js';

@Module({
  providers: [HocuspocusServer],
  exports: [HocuspocusServer],
})
export class HocuspocusModule {}

