package com.ktc4.pusan4.judgment.domain;

/**
 * 한 과세연도의 한도 버킷 합계 (api.md 3.7 limits). 한도는 연간 총액이라 초과액도 연 단위로만 정해진다(#15).
 *
 * @param totalAmount  그해 버킷에 태그된 금액 합 (한도 전)
 * @param excessAmount 한도를 넘어 필요경비에 넣지 않는 금액. 넘지 않았으면 0
 */
public record LimitYearTotal(String bucket, int taxYear, long totalAmount, long excessAmount) {

    public boolean exceeded() {
        return excessAmount > 0;
    }
}
