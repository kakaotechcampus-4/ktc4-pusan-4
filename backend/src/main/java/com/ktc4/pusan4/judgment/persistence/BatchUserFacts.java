package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.UserFact;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * batch 의 최신 UserFact 를 batch 마다 처음 판정할 때 한 번 읽어 둔다. 판정 작업 하나(run 하나, 재판정 한 번) 동안만 쓴다.
 * run 은 문진 버전처럼 사용자 사실도 시작 시점 것으로 판정한다. run 도중 들어온 답변은 그 run 의 남은 거래에 반영되지 않는다.
 */
final class BatchUserFacts {

    private final UserFactPersistenceService userFactService;
    private final Map<UUID, List<UserFact>> factsByBatchId = new HashMap<>();

    BatchUserFacts(UserFactPersistenceService userFactService) {
        this.userFactService = userFactService;
    }

    List<UserFact> latest(UUID userId, UUID batchId) {
        return factsByBatchId.computeIfAbsent(batchId, id -> userFactService.findAllLatest(userId, id));
    }
}
