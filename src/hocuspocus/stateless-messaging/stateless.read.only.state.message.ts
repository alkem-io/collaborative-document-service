import { StatelessBaseMessage } from './stateless.base.message';
import { ReadOnlyCode } from '../extensions/authentication';

export interface StatelessReadOnlyStateMessage extends StatelessBaseMessage {
  event: 'read-only-state';
  readOnly: boolean;
  readOnlyCode?: ReadOnlyCode;
}

export const isStatelessReadOnlyStateMessage = (
  data: StatelessBaseMessage
): data is StatelessReadOnlyStateMessage => {
  return data.event === 'read-only-state';
};
