import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    this.logger.warn(
      `HttpException ${status} ${request.method} ${request.url} - ${exception.message}`,
    );
    if (status >= 500) {
      this.logger.error(
        `HttpException stack: ${(exception as Error)?.stack ?? 'n/a'}`,
      );
    }
    if (status >= 400 && status < 500 && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const body = request.body;
      if (body && Object.keys(body).length > 0) {
        const sensitive = ['password', 'refreshToken', 'accessToken'];
        const sanitized = { ...body };
        for (const k of sensitive) {
          if (k in sanitized) sanitized[k] = '[REDACTED]';
        }
        this.logger.warn(`HttpException ${status} request body: ${JSON.stringify(sanitized)}`);
      }
    }

    const error =
      typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : (exceptionResponse as object);

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      ...error,
    });
  }
}
