package com.ktc4.pusan4.judgment.domain;

import java.util.List;
import java.util.Map;

/**
 * 대기 질문 그룹 하나의 지난번 답 (api.md 3.14). 등급에 따라 채우는 필드가 다르고 나머지는 null 이다.
 *
 * @param value         A 에서 이어받을 값. 충돌·일괄 응답·이력 없음이면 null
 * @param conflict      A 에서 최근 두 업로드의 답이 다르면 true
 * @param history       A 에서 value 를 채우지 않은 사정
 * @param historyCounts B 에서 같은 가맹점의 지난 답 값별 질문 수
 * @param reason        C 에서 보여주지 않는 이유
 * @param questionCount 그룹의 질문 수. 진행 상황의 fillableFromPrevious 를 셀 때 쓴다
 */
public record PreviousAnswerSuggestion(
    String groupKey,
    String factType,
    String code,
    String tier,
    String value,
    String sourceLabel,
    Boolean conflict,
    List<History> history,
    Map<String, Integer> historyCounts,
    String reason,
    int questionCount
) {

    public record History(String value, String sourceLabel, boolean bulk) {
    }

    /** 확인 목록으로 한 번에 적용할 수 있는 그룹인지. */
    public boolean fillable() {
        return PreviousAnswer.CARRY.tier().equals(tier) && value != null;
    }
}
