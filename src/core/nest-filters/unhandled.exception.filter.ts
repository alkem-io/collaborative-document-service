import { randomUUID } from 'crypto';
import { ExceptionFilter, Catch, Inject, ArgumentsHost, ContextType } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';

@Catch(Error)
export class UnhandledExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: WinstonLogger
  ) {}

  catch(exception: Error, host: ArgumentsHost) {
    /* add values that you want to include as additional data
     e.g. secondParam = { code: '123' };
    */
    const secondParam = { stack: exception.stack, errorId: randomUUID() };
    const thirdParam = 'UnhandledException';
    /* the logger will handle the passed exception by iteration over all it's fields
     * you can provide additional data in the stack and context
     */
    this.logger.error(exception, JSON.stringify(secondParam), thirdParam);

    const contextType = host.getType<ContextType>();
    // If we are in an http context respond something so the browser doesn't stay hanging.
    if (contextType === 'http') {
      const httpArguments = host.switchToHttp();
      const response = httpArguments.getResponse();

      response.status(500).json({
        statusCode: 500,
        timestamp: new Date().toISOString(),
        errorId: secondParam.errorId,
        name: process.env.NODE_ENV !== 'production' ? exception.name : undefined,
        message:
          process.env.NODE_ENV !== 'production' ? exception.message : 'Internal Server Error',
        stack: process.env.NODE_ENV !== 'production' ? exception.stack : undefined,
      });
    }
    // something needs to be returned so the default ExceptionsHandler is not triggered
    return exception;
  }
}
