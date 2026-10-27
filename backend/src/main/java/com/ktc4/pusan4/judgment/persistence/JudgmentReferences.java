package com.ktc4.pusan4.judgment.persistence;

import java.time.LocalDate;
import java.util.Set;

/**
 * 판정 작업 하나(run 하나, 재판정 한 번) 동안 거래마다 다시 읽지 않는 판정 입력.
 * run 은 거래마다 따로 커밋하지만 이 값은 시작할 때 읽은 것을 끝까지 쓴다. 한 작업 안에서 기준이 섞이지 않는다.
 */
record JudgmentReferences(Set<LocalDate> publicHolidays, StatuteVersions statuteVersions, BatchUserFacts userFacts) {
}
