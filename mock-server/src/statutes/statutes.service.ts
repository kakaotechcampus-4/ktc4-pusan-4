import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { StoreService } from '../store/store.service';

@Injectable()
export class StatutesService {
  constructor(private readonly store: StoreService) {}

  detail(statuteVersionId: number) {
    const statute = this.store.statutes.find((s) => s.statuteVersionId === statuteVersionId);
    if (!statute) throw new ApiError(404, 'STATUTE_NOT_FOUND', '요청한 법령을 찾을 수 없습니다.');
    return statute;
  }
}
