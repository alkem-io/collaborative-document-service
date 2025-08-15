import { BaseException, ExceptionDetails } from '@src/common/exceptions';
import { LogContext } from '@common/enums';

export class RetryException extends BaseException {
  constructor(
    public readonly context: LogContext,
    public readonly details?: ExceptionDetails
  ) {
    super('Retries exceeded', context, details);
  }
}
