import { randomUUID } from 'crypto';
import { LogContext } from '../enums';
import { ExceptionDetails } from './exception.details';

export class BaseException extends Error {
  public readonly errorId: string = randomUUID();
  constructor(
    /**
     * No identifiable information or UUIDs in the message, please. Use the `details` instead.
     */
    public message: string,
    public context: LogContext,
    public details?: ExceptionDetails
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
