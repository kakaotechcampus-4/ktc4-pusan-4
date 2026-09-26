package com.ktc4.pusan4.merchant.api;

import com.ktc4.pusan4.shared.api.PageResponse.PageMeta;

import java.util.List;

/**
 * 문서용 타입. {@link ClassificationReviewPage} 참고.
 */
public record ClassificationReviewGroupPage(List<ClassificationReviewGroupResponse> items, PageMeta page) {
}
