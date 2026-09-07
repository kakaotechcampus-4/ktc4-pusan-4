package kr.taxmate.preprocess.t1;

import java.util.List;

/**
 * T1 정규화 결과. 파이썬 {@code Result} 와 필드 이름이 1:1로 대응한다.
 *
 * <p>{@code normKey} 는 키이고 나머지는 왜 그 키가 나왔는지를 설명하는 값이다.
 * 되묻기 화면과 리포트가 뒤쪽 필드를 쓴다.
 *
 * @param raw            원문 상호
 * @param normKey        트랙이 고른 키. 사업자번호이거나 정규화된 문자열이다
 * @param track          bizno · overseas · string
 * @param stringNorm     문자열 트랙 결과. 트랙과 무관하게 항상 채워진다
 * @param overseasNorm   해외로 판정됐을 때만 stringNorm 과 같은 값, 아니면 빈 문자열
 * @param tokens         구분자로 분해된 토큰. 분해되지 않았으면 비어 있다
 * @param truncated      EUC-KR 바이트가 한계값과 정확히 같아 카드사가 자른 것으로 본 경우
 * @param overseas       사업자번호 없음 + 영문 비율 기준을 넘긴 경우
 * @param encBytes       절단 판정에 쓴 바이트 수
 * @param branchSkipped  절단이라 지점명 제거를 건너뛴 경우
 * @param branchBlocked  min_keep 에 막혀 적용하지 못한 지점명 패턴들
 * @param protectedTokens 축약 과정에서 사라져 되돌린 예외 토큰들
 * @param pgHint         분해 시점에 걸린 PG 힌트 패턴. 정식 판정은 T2 가 한다
 * @param condSplit      조건부 구분자('-')를 실제로 잘랐는지
 * @param condKept       조건부 구분자를 자르지 않고 원문을 유지했는지
 * @param collapsed      반복 토큰을 접었는지
 */
public record T1Result(
        String raw,
        String normKey,
        String track,
        String stringNorm,
        String overseasNorm,
        List<String> tokens,
        boolean truncated,
        boolean overseas,
        int encBytes,
        boolean branchSkipped,
        List<String> branchBlocked,
        List<String> protectedTokens,
        String pgHint,
        boolean condSplit,
        boolean condKept,
        boolean collapsed
) {
    /** 사전·룰 조회에 쓸 단위. 분해되지 않았으면 키 하나짜리 목록이다. */
    public List<String> lookupUnits() {
        return tokens.isEmpty() ? List.of(stringNorm) : tokens;
    }
}
