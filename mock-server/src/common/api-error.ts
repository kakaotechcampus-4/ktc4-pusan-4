import { HttpException } from '@nestjs/common';

/**
 * 컨트롤러/서비스는 이 예외만 던진다. 전역 필터가 {code,message,traceId} 모양으로 변환한다.
 */
export class ApiError extends HttpException {
  constructor(status: number, code: string, message: string) {
    super({ code, message }, status);
  }
}
