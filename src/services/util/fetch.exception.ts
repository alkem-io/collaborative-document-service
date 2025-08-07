import { BaseException, ExceptionDetails } from '@common/exceptions';
import { LogContext } from '@common/enums';

export class FetchException extends BaseException {
  constructor(
    public readonly message: string,
    public readonly context: LogContext,
    public readonly details?: ExceptionDetails
  ) {
    super(message, context, details);
  }
}
