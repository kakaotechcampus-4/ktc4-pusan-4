import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { v7 as uuidv7 } from 'uuid';

const DEFAULT_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  500: 'INTERNAL_ERROR',
};

/**
 * docs/api.md 1.3 공통 에러 응답 {code,message,traceId}로 모든 예외를 통일한다.
 * class-validator 기본 400처럼 문서에 없는 실패는 VALIDATION_ERROR로 fallback한다.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;

    let code = DEFAULT_CODES[status] ?? 'INTERNAL_ERROR';
    let message = '알 수 없는 오류가 발생했습니다.';

    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      if (typeof record.code === 'string') code = record.code;
      if (typeof record.message === 'string') {
        message = record.message;
      } else if (Array.isArray(record.message)) {
        message = record.message.join(', ');
      }
    } else if (typeof body === 'string') {
      message = body;
    }

    response.status(status).json({ code, message, traceId: uuidv7() });
  }
}
