package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.StatuteVersion;
import com.ktc4.pusan4.shared.api.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 법령 원문 (api.md 3.13). 사용자 데이터가 아니라 소유자 확인 없이 id 로 찾는다.
 */
@Service
public class StatuteService {

    private final StatuteVersionRepository statuteRepository;

    public StatuteService(StatuteVersionRepository statuteRepository) {
        this.statuteRepository = statuteRepository;
    }

    @Transactional(readOnly = true)
    public StatuteVersion get(long statuteVersionId) {
        return statuteRepository.findById(statuteVersionId)
            .map(StatuteVersionEntity::toDomain)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "STATUTE_NOT_FOUND", "법령을 찾을 수 없습니다."));
    }
}
