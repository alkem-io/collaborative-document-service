import { LogContext } from '../enums';
import { ExceptionDetails } from './exception.details';
import { BaseException } from './base.exception';

export class NotInitializedException extends BaseException {
  constructor(
    /**
     * No identifiable information or UUIDs in the message, please. Use the `details` instead.
     */
    public message: string,
    public context: LogContext,
    public details?: ExceptionDetails
  ) {
    super(message, context, details);
  }
}
