package com.ktc4.pusan4.merchant.classify;

/**
 * 분류할 거래 한 건.
 *
 * @param merchantRaw 프론트가 파싱해 보낸 원문 상호
 * @param bizNo       가맹점 사업자번호. 없으면 빈 문자열이나 {@code null}
 */
public record ClassificationInput(String merchantRaw, String bizNo) {
}
