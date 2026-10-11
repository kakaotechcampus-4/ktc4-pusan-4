package com.ktc4.pusan4.merchant.pg;

import java.util.List;

/**
 * PG 차단 판정 결과. 파이썬 {@code PGBlocklist.check} 의 반환값과 대응한다.
 *
 * <p>파이썬의 {@code needs_review} 는 옮기지 않는다. 되묻기는 {@code PG_미상} 카드(R-105)가 한다.
 *
 * @param blocked         PG 차단 대상인지
 * @param pgTokens        PG 로 판정된 토큰. 토큰에서 못 찾고 원문에서 찾았으면 원문 하나
 * @param matchedPatterns 걸린 패턴 원문(정렬·중복 제거) = 파이썬 {@code matched_patterns}
 * @param hintTokens      PG 가 아닌 토큰. 되묻기 화면 힌트 = 파이썬 {@code matched_suffix}
 * @param droppedTokens   힌트가 되지 않는 구조 토큰('대표', 'N건') = 파이썬 {@code dropped_tokens}
 * @param category        차단 시 {@code on_match.category}({@code PG_미상}), 아니면 {@code null}
 * @param seedInsert      차단 시 {@code on_match.seed_insert}. {@code false} 면 merchant_dict 에 쓰지 않는다
 */
public record PgBlockResult(
        boolean blocked,
        List<String> pgTokens,
        List<String> matchedPatterns,
        List<String> hintTokens,
        List<String> droppedTokens,
        String category,
        boolean seedInsert
) {
    public static PgBlockResult notBlocked() {
        return new PgBlockResult(false, List.of(), List.of(), List.of(), List.of(), null, false);
    }
}
