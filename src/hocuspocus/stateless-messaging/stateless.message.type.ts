import { StatelessSaveMessage } from './stateless.save.message.type';
import { StatelessReadOnlyStateMessage } from './stateless.read.only.state.message.type';

export type StatelessMessage = StatelessSaveMessage | StatelessReadOnlyStateMessage; // to be filled up with other message types as we go
