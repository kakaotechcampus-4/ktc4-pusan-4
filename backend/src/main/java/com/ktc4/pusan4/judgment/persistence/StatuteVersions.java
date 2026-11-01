package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.persistence.StatuteVersionRepository.VersionPeriod;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 조문 버전 기간을 판정 작업 하나(run 하나, 재판정 한 번)를 시작할 때 한 번 읽어 두고, 판정일에 유효한 버전을 메모리에서 고른다.
 * 그 사이 법령 동기화가 돌아도 작업은 시작할 때 읽은 버전으로 끝난다.
 *
 * <p>읽을 조문은 규칙 카드가 인용할 수 있는 조문(RuleSet.statuteIds)이다. 카드는 배포할 때만 바뀌고
 * 조문 버전은 운영 중에도 바뀌어서, 목록은 카드와 같이 기동할 때, 버전은 작업마다 읽는다.
 * 목록에 없는 조문이 인용되면 그때 읽는다.
 */
final class StatuteVersions {

    private final StatuteVersionRepository repository;
    private final Map<String, List<VersionPeriod>> periodsByStatuteId = new HashMap<>();

    StatuteVersions(StatuteVersionRepository repository, Set<String> statuteIds) {
        this.repository = repository;
        if (!statuteIds.isEmpty()) {
            Map<String, List<VersionPeriod>> loaded = repository.findPeriods(statuteIds).stream()
                .collect(Collectors.groupingBy(VersionPeriod::statuteId));
            statuteIds.forEach(statuteId -> periodsByStatuteId.put(statuteId, loaded.getOrDefault(statuteId, List.of())));
        }
    }

    long effectiveVersionId(String statuteId, LocalDate date) {
        List<Long> versionIds = periodsByStatuteId
            .computeIfAbsent(statuteId, id -> repository.findPeriods(List.of(id)))
            .stream()
            .filter(period -> period.isEffectiveOn(date))
            .map(VersionPeriod::id)
            .toList();
        if (versionIds.size() != 1) {
            throw new IllegalStateException("Expected one effective statute version for " + statuteId);
        }
        return versionIds.getFirst();
    }
}
