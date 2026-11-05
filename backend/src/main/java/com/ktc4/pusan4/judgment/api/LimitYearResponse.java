package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.LimitYearTotal;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "한 과세연도의 한도 합계(api.md 3.7 limits). 한도는 사용자의 한 해 전체 기준이다")
public record LimitYearResponse(
    @Schema(description = "한도 묶음. 판정 attributes 의 limit_bucket 과 같은 값", example = "접대비") String bucket,
    @Schema(example = "2026") int taxYear,
    @Schema(description = "그해 이 묶음 판정의 금액 합(한도 전)", example = "13006500") long totalAmount,
    @Schema(description = "한도를 넘어 필요경비에 넣지 않는 금액. 넘지 않았으면 0", example = "916500") long excessAmount
) {

    static List<LimitYearResponse> from(List<LimitYearTotal> limits) {
        return limits.stream()
            .map(limit -> new LimitYearResponse(limit.bucket(), limit.taxYear(), limit.totalAmount(),
                limit.excessAmount()))
            .toList();
    }
}
