import { BaseException, ExceptionDetails } from '@src/common/exceptions';
import { LogContext } from '@common/enums';

export class TimeoutException extends BaseException {
  constructor(
    public readonly context: LogContext,
    public readonly details?: ExceptionDetails
  ) {
    super('Timeout', context, details);
  }
}
