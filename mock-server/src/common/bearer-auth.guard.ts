import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ApiError } from './api-error';

/**
 * 실제 토큰 검증은 하지 않는다. Authorization: Bearer ... 헤더 존재 여부만 확인한다.
 * mock에는 시딩된 사용자 1명만 존재하므로 "인증됨"은 헤더 형태 존재로 충분하다.
 */
@Injectable()
export class BearerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ') || header.slice(7).trim().length === 0) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authorization 헤더가 필요합니다.');
    }
    return true;
  }
}
