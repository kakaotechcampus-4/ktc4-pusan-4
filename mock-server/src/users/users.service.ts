import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { nowKst } from '../common/time';
import { StoreService } from '../store/store.service';
import { CreateContextDto } from './dto/create-context.dto';

@Injectable()
export class UsersService {
  constructor(private readonly store: StoreService) {}

  me() {
    const user = this.store.currentUser();
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }

  deleteMe(): void {
    // mock: 실제 계정 삭제는 하지 않는다. 204 응답만 재현한다.
  }

  createContext(dto: CreateContextDto) {
    const user = this.store.currentUser();
    const existing = this.store.contexts.filter((c) => c.userId === user.id);
    const version = existing.length > 0 ? Math.max(...existing.map((c) => c.version)) + 1 : 1;
    const context = {
      id: this.store.newId(),
      userId: user.id,
      version,
      industryCode: dto.industryCode,
      prevYearRevenue: dto.prevYearRevenue,
      businessOpenDate: dto.businessOpenDate,
      bookkeepingDuty: dto.bookkeepingDuty,
      hasEmployee: dto.hasEmployee,
      homeOfficeRatio: dto.homeOfficeRatio ?? null,
      createdAt: nowKst(),
    };
    this.store.contexts.push(context);
    return { id: context.id, version: context.version };
  }

  currentContext() {
    const context = this.store.currentContext();
    if (!context) {
      throw new ApiError(404, 'CONTEXT_NOT_FOUND', '아직 등록된 사업자 정보가 없습니다.');
    }
    return context;
  }

  contextHistory() {
    const user = this.store.currentUser();
    return this.store.contexts.filter((c) => c.userId === user.id).sort((a, b) => a.version - b.version);
  }
}
