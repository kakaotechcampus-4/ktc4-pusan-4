package com.ktc4.pusan4.transaction.domain;

import com.ktc4.pusan4.transaction.api.CardIssuer;
import com.ktc4.pusan4.transaction.api.SourceType;

import java.time.LocalDate;
import java.util.List;

/**
 * 업로드 요청 한 건을 서비스로 넘기는 값. 요청 DTO 의 검증(api.md 3.3 의 422)을 통과한 뒤에 만든다.
 */
public record NewUploadBatch(
    SourceType sourceType,
    CardIssuer cardIssuer,
    LocalDate periodStart,
    LocalDate periodEnd,
    String fileHash,
    List<NewTransaction> transactions
) {
}
