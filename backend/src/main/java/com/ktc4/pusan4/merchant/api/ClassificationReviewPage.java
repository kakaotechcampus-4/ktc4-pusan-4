package com.ktc4.pusan4.merchant.api;

import com.ktc4.pusan4.shared.api.ContractNotes;
import com.ktc4.pusan4.shared.api.PageResponse.PageMeta;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.Map;

/**
 * 문서용 타입. grouped 값에 따라 응답 항목 모양이 갈려서 두 형태를 oneOf 로 보여 준다.
 */
public record ClassificationReviewPage(
    @Schema(description = "grouped=false 일 때의 항목. " + ContractNotes.SHAPE_UNSPECIFIED)
    List<Map<String, Object>> items, PageMeta page) {
}
